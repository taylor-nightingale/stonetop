import {
	MoveCategorySnapshotBuilder,
	MovelistBuilder,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import {
	withCategoryFields,
	computeSelectable,
	incrementMove,
	decrementMove,
	buildMoveSnapshot,
	findMoveItemBySlug,
	openMoveSheet,
} from "../embeddedMoves.js";
import { ReferenceMoveSeeder } from "../ReferenceMoveSeeder.js";
import { GrantedItems } from "../GrantedItems.js";
import { GrantSource, ItemGrant, ItemGrantSet } from "../../model/data/ItemGrant.js";
import { toSlug } from "../../utils/slug.js";

export class CharacterMoves {
	constructor(moveRepo, actor, resourceController, factory = null, grantedItems = new GrantedItems(actor)) {
		this._moveRepo           = moveRepo;
		this._actor              = actor;
		this._resourceController = resourceController;
		this._factory            = factory;
		this._grantedItems       = grantedItems;
		this._seeder             = new ReferenceMoveSeeder(actor, moveRepo, this._grantedItems);
	}

	setVitals(vitals) { this._vitals = vitals; }

	// Reference moves are seeded onto every character and shown in the sidebar (not the moves
	// tab): basic, plus the expedition, universal special, and follower moves. Seeded once at actor
	// creation (CreateActor hook), NOT on render — thereafter they are ordinary owned items the GM
	// can edit, delete, or re-add via drag-drop. One list, so a category added to the packs later
	// reaches both new characters (here) and existing ones (migrateReferenceMoveCategories).
	static REFERENCE_CATEGORIES = ["basic", "expedition", "special", "follower"];

	async initBasicMoves() {
		for (const moveType of CharacterMoves.REFERENCE_CATEGORIES) {
			await this.seedReferenceCategory(moveType);
		}
	}

	async seedReferenceCategory(categoryKey) {
		await this._seeder.seed(categoryKey);
	}

	async seedReferenceSlugs(categoryKey, slugs) {
		await this._seeder.seedSlugs(categoryKey, slugs);
	}

	// A playbook owns its moves by slug (playbookData.moves) and marks a subset as starting
	// (playbookData.startingMoves) — those seed acquired at character creation. Resolution + sort
	// (by level + dependency) live here; the move items themselves carry no playbook back-reference.
	async initPlaybookCategory(playbookData) {
		await this._grantedItems.sync(await this.playbookGrants(playbookData));
	}

	/** Every move this playbook wants the character to own, keyed by slug. `alsoStarting` are the slugs
	 *  something else about the character (its background) makes starting moves too. */
	async playbookGrants(playbookData, alsoStarting = []) {
		const resolved = await this._moveRepo.getMovesBySlugs(playbookData.moves ?? []);
		return this._grantsFor(`playbook-${playbookData.slug}`, this.sortPlaybookMoves(resolved), {
			starting:      new Set([...(playbookData.startingMoves ?? []), ...alsoStarting]),
			categoryLabel: playbookData.name,
			categoryNote:  playbookData.startingMovesNote ?? null,
		});
	}

	// Register a move category (insert or arcanum) from a list of move slugs. Inserts pass their
	// `system.moves`, arcana their `back.moveSlugs`; both resolve across compendium + world. A move
	// seeds acquired iff its slug is in `startingSlugs` — built-in inserts pass all their moves
	// (active on grant), arcana pass none (player ticks each mystery to unlock).
	async addCategory(key, label, moveSlugs = [], startingSlugs = []) {
		if (!moveSlugs.length) return;
		await this._grantedItems.sync(await this.categoryGrants(key, label, moveSlugs, startingSlugs));
	}

	/** The moves an insert or arcanum wants the character to own. Because this is a diff and not an
	 *  all-or-nothing "does the category exist" check, a move the packs add later reaches a character
	 *  that already has the rest. */
	async categoryGrants(key, label, moveSlugs = [], startingSlugs = []) {
		const entries = await this._moveRepo.getMovesBySlugs(moveSlugs);
		return this._grantsFor(key, entries, { starting: new Set(startingSlugs), categoryLabel: label });
	}

	// Resolve a category's moves to their compendium documents and stamp each one for embedding. The one
	// pipeline behind every move grant — a move that no longer resolves is dropped, not granted empty.
	async _grantsFor(categoryKey, moves, { starting, categoryLabel, categoryNote = null }) {
		const docs = await Promise.all(moves.map(m => this._moveRepo.getReferencedMoveDocument(m.id)));
		return new ItemGrantSet(GrantSource.forCategoryKey(categoryKey),
			moves
				.map((move, i) => ({ move, doc: docs[i] }))
				.filter(({ doc }) => doc)
				.map(({ move, doc }, i) => new ItemGrant(
					withCategoryFields(doc.toObject(), categoryKey, starting.has(move.slug), {
						sortOrder:    i,
						compendiumId: doc._id ?? null,
						categoryLabel,
						categoryNote,
					}))),
		);
	}

	// Un-grants by the same source the category was granted under, so the write and the unwrite read the
	// same fact. `categoryKey` stays a display concern (which list a move renders in), not provenance.
	async removeCategory(key) {
		await this._grantedItems.revoke(GrantSource.forCategoryKey(key));
	}

	async incrementMove(categoryKey, moveSlug) {
		await incrementMove(this._actor, categoryKey, moveSlug);
	}

	async decrementMove(categoryKey, moveSlug) {
		await decrementMove(this._actor, categoryKey, moveSlug);
	}

	// A move the player dropped in. Matched on the STORED slug, like every other move lookup — matching
	// on the name alone let a renamed move in as a second copy of one already there.
	async addMoveToOther(moveData) {
		const moveSlug = moveData.system?.slug ?? toSlug(moveData.name);
		const existing = [...this._actor.items].filter(i => i.type === "move" && i.system?.categoryKey === "other");
		if (existing.some(i => (i.system?.slug ?? toSlug(i.name)) === moveSlug)) return false;
		await this._grantedItems.addAuthored([{
			...moveData,
			name: moveData.name,
			type: "move",
			system: {
				...moveData.system,
				moveType: "other", categoryKey: "other", categoryLabel: null, categoryNote: null,
				acquired: true, instanceCount: 1,
				sortOrder: existing.length, compendiumId: moveData._id ?? null,
			},
		}]);
		return true;
	}

	async deleteMove(moveSlug) {
		const item = [...this._actor.items].find(
			i => i.type === "move" && i.system?.categoryKey === "other"
				&& (i.system?.slug ?? toSlug(i.name)) === moveSlug
		);
		if (!item) return;
		await this._actor.deleteEmbeddedDocuments("Item", [item._id]);
	}

	// Post the move's full text (description + all result tiers) to chat, without rolling. Returns
	// false when no owned move item carries the slug (the caller may have a non-item fallback).
	async sendToChat(moveSlug) {
		const item = findMoveItemBySlug(this._actor, moveSlug);
		if (!item) return false;
		await this._actor.sendItemToChat(item);
		return true;
	}

	/** Open this move's own item sheet — see embeddedMoves.openMoveSheet. */
	async openSheet(moveSlug) {
		return openMoveSheet(this._actor, moveSlug, this._moveRepo);
	}

	/** The controller for one move's picks, or null when the move is absent or has no choice group. */
	controllerFor(moveSlug) {
		const item = findMoveItemBySlug(this._actor, moveSlug);
		return item?.system?.choices ? this._factory.forDocument(item._id, "pickValues") : null;
	}

	// The current value of a move's own track — the Thrall's Favor, say. Null when the character
	// doesn't own the move or the move has no track, which keeps "no such stat" distinct from a
	// track sitting at 0.
	resourceValue(moveSlug) {
		const item = findMoveItemBySlug(this._actor, moveSlug);
		if (!item?.system?.resource) return null;
		return this._resourceController.getCurrent("moves", moveSlug);
	}

	async setMoveResourceCurrent(moveSlug, current) {
		await this._resourceController.set("moves", moveSlug, current);
	}

	async setMoveResourceText(moveSlug, value) {
		await this._resourceController.setText("moves", moveSlug, value);
	}

	async buildSnapshot() {
		const allMoveItems = [...this._actor.items].filter(i => i.type === "move");
		const level              = this._vitals?.level ?? 1;
		const acquiredSlugs      = _acquiredSlugs(allMoveItems);
		const resourceController = this._resourceController;

		// One MoveSnapshot per move item, keyed by slug — the `bySlug` registry an inline move grant (in
		// any choice row) resolves against, so it renders rollable with its resource. Built for EVERY move,
		// including arcana-<slug> moves that are kept off the tab below.
		const snapById = new Map();
		const bySlug   = {};
		for (const item of allMoveItems) {
			const snap = await buildMoveSnapshot(item, item.system?.categoryKey ?? "other",
				computeSelectable(item),
				_requirementsMet(item.system ?? null, level, acquiredSlugs),
				resourceController);
			snapById.set(item, snap);
			if (snap.slug) bySlug[snap.slug] = snap;
		}

		// Arcana moves live in `arcana-<slug>` categories; they render on their arcanum card, not the moves
		// tab. They still count toward acquiredSlugs above (for other moves' requirements) and stay in bySlug.
		const tabMoveItems = allMoveItems.filter(i => !(i.system?.categoryKey ?? "").startsWith("arcana-"));

		const byCatKey = new Map();
		for (const item of tabMoveItems) {
			const key = item.system?.categoryKey ?? "other";
			if (!byCatKey.has(key)) byCatKey.set(key, []);
			byCatKey.get(key).push(item);
		}
		for (const items of byCatKey.values()) {
			items.sort((a, b) => (a.system?.sortOrder ?? 999) - (b.system?.sortOrder ?? 999));
		}

		const sortedKeys = [...byCatKey.keys()].sort((a, b) => _categoryOrder(a) - _categoryOrder(b));

		const categories = sortedKeys.map(catKey => {
			const meta  = _categoryMetadata(catKey, byCatKey.get(catKey));
			const moves = byCatKey.get(catKey).map(item => snapById.get(item));
			return new MoveCategorySnapshotBuilder()
				.withKey(meta.key).withLabel(meta.label).withRenderStyle(meta.renderStyle)
				.withAllowAdditional(meta.allowAdditional).withNote(meta.note)
				.withMoves(moves).build();
		});
		return new MovelistBuilder().withCategories(categories).withBySlug(bySlug).build();
	}

	countOwnedBySlug(moveSlug) {
		const item = [...this._actor.items].find(
			i => i.type === "move" && toSlug(i.name) === moveSlug
		);
		return item?.system?.instanceCount ?? 0;
	}

	async getMoveSnapshotsForCategory(key) {
		const items = [...this._actor.items]
			.filter(i => i.type === "move" && i.system?.categoryKey === key)
			.sort((a, b) => (a.system?.sortOrder ?? 999) - (b.system?.sortOrder ?? 999));
		if (!items.length) return [];
		const level = this._vitals?.level ?? 1;
		const allMoveItems  = [...this._actor.items].filter(i => i.type === "move");
		const acquiredSlugs = _acquiredSlugs(allMoveItems);
		return Promise.all(items.map(item =>
			buildMoveSnapshot(item, key,
				computeSelectable(item),
				_requirementsMet(item.system ?? null, level, acquiredSlugs),
				this._resourceController)
		));
	}

	async onDropMove(itemData) {
		const itemSlug = toSlug(itemData.name);
		const existing = [...this._actor.items].find(
			i => i.type === "move" && toSlug(i.name) === itemSlug
		);
		if (existing) {
			if (computeSelectable(existing)) {
				await this.incrementMove(existing.system?.categoryKey, itemSlug);
				return true;
			}
			return false;
		}
		return this.addMoveToOther(itemData);
	}

	sortPlaybookMoves(moves) {
		const groups = new Map();
		for (const move of moves) {
			const key = move.minLevel ?? 0;
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key).push(move);
		}
		const result = [];
		for (const level of [...groups.keys()].sort((a, b) => a - b)) {
			result.push(..._sortGroup(groups.get(level), new Set(groups.get(level).map(m => m.name))));
		}
		return result;
	}

}

// ── Private helpers ───────────────────────────────────────────────────────────

function _acquiredSlugs(moveItems) {
	return new Set(
		moveItems
			.filter(i => i.system?.acquired ?? false)
			.map(i => i.system?.slug ?? toSlug(i.name))
	);
}

function _categoryOrder(key) {
	if (key.startsWith("playbook-")) return 0;
	if (key === "basic")             return 1;
	if (key === "expedition")        return 2;
	if (key === "special")           return 3;
	if (key === "follower")          return 4;
	if (key.startsWith("insert-")) return 5;
	if (key === "other")             return 6;
	return 7;
}

function _categoryMetadata(catKey, catItems) {
	if (catKey === "basic")    return { key: "basic",    label: "Basic Moves",    renderStyle: "side-bar", allowAdditional: false, note: null };
	if (catKey === "expedition") return { key: "expedition", label: "Expedition Moves", renderStyle: "side-bar", allowAdditional: false, note: null };
	if (catKey === "special")  return { key: "special",  label: "Special Moves",  renderStyle: "side-bar", allowAdditional: false, note: null };
	if (catKey === "follower") return { key: "follower", label: "Follower Moves", renderStyle: "side-bar", allowAdditional: false, note: null };
	if (catKey === "other") return { key: "other", label: "Other Moves", renderStyle: "standard", allowAdditional: true,  note: null };
	const label = catItems[0]?.system?.categoryLabel ?? catKey;
	const note  = catItems[0]?.system?.categoryNote  ?? null;
	return { key: catKey, label, renderStyle: "standard", allowAdditional: false, note };
}

function _requirementsMet(move, level, acquiredSlugs) {
	const req = move?.requirement;
	if (!req) return true;
	if (req.level && level < req.level) return false;
	if ((req.moves ?? []).some(name => !acquiredSlugs.has(toSlug(name)))) return false;
	return true;
}

function _sortGroup(moves, groupNames) {
	const dependents = new Map();
	const roots = [];
	for (const move of moves) {
		if (!move.requires || !groupNames.has(move.requires)) roots.push(move);
		else {
			if (!dependents.has(move.requires)) dependents.set(move.requires, []);
			dependents.get(move.requires).push(move);
		}
	}
	roots.sort((a, b) => a.name.localeCompare(b.name));
	for (const deps of dependents.values()) deps.sort((a, b) => a.name.localeCompare(b.name));
	const result  = [];
	const visited = new Set();

	function visit(move) {
		if (visited.has(move.name)) return;
		visited.add(move.name);
		result.push(move);
		for (const child of dependents.get(move.name) ?? []) visit(child);
	}

	for (const root of roots) visit(root);
	moves.filter(m => !visited.has(m.name)).sort((a, b) => a.name.localeCompare(b.name)).forEach(m => result.push(m));
	return result;
}

