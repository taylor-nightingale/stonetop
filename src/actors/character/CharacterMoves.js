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
} from "../embeddedMoves.js";
import { ReferenceMoveSeeder } from "../ReferenceMoveSeeder.js";
import { toSlug } from "../../utils/slug.js";

export class CharacterMoves {
	constructor(moveRepo, actor, resourceController, factory = null) {
		this._moveRepo           = moveRepo;
		this._actor              = actor;
		this._resourceController = resourceController;
		this._factory            = factory;
		this._seeder             = new ReferenceMoveSeeder(actor, moveRepo);
	}

	setVitals(vitals) { this._vitals = vitals; }

	// Reference moves are seeded onto every character and shown in the sidebar (not the moves
	// tab): basic, plus the universal special moves and follower moves. Seeded once at actor
	// creation (CreateActor hook), NOT on render — thereafter they are ordinary owned items the GM
	// can edit, delete, or re-add via drag-drop.
	async initBasicMoves() {
		for (const moveType of ["basic", "special", "follower"]) {
			await this._seeder.seed(moveType);
		}
	}

	// A playbook owns its moves by slug (playbookData.moves) and marks a subset as starting
	// (playbookData.startingMoves) — those seed acquired at character creation. Resolution + sort
	// (by level + dependency) live here; the move items themselves carry no playbook back-reference.
	async initPlaybookCategory(playbookData) {
		const existingPlaybook = [...this._actor.items]
			.filter(i => i.type === "move" && i.system?.categoryKey?.startsWith("playbook-"));
		if (existingPlaybook.length) {
			await this._actor.deleteEmbeddedDocuments("Item", existingPlaybook.map(i => i._id));
		}
		const resolved = await this._moveRepo.getMovesBySlugs(playbookData.moves ?? []);
		const playbookMoves = this.sortPlaybookMoves(resolved);
		const starting = new Set(playbookData.startingMoves ?? []);
		const catKey = `playbook-${playbookData.slug}`;
		const pairs = await Promise.all(
			playbookMoves.map(async (m, i) => ({ move: m, doc: await this._moveRepo.getReferencedMoveDocument(m.id), index: i }))
		);
		await this._actor.createEmbeddedDocuments("Item",
			pairs
				.filter(({ doc }) => doc !== null)
				.map(({ move, doc, index }) => withCategoryFields(doc.toObject(), catKey, starting.has(move.slug), {
					sortOrder:     index,
					compendiumId:  doc._id ?? null,
					categoryLabel: playbookData.name,
					categoryNote:  playbookData.startingMovesNote ?? null,
				}))
		);
	}

	// Register a move category (insert or arcanum) from a list of move slugs. Inserts pass their
	// `system.moves`, arcana their `back.moveSlugs`; both resolve across compendium + world. A move
	// seeds acquired iff its slug is in `startingSlugs` — built-in inserts pass all their moves
	// (active on grant), arcana pass none (player ticks each mystery to unlock).
	async addCategory(key, label, moveSlugs = [], startingSlugs = []) {
		const exists = [...this._actor.items].some(i => i.type === "move" && i.system?.categoryKey === key);
		if (exists) return;
		const starting = new Set(startingSlugs);
		const entries = await this._moveRepo.getMovesBySlugs(moveSlugs);
		const pairs = await Promise.all(
			entries.map(async move => ({ move, doc: await this._moveRepo.getReferencedMoveDocument(move.id) }))
		);
		await this._actor.createEmbeddedDocuments("Item",
			pairs.filter(({ doc }) => doc).map(({ move, doc }, i) =>
				withCategoryFields(doc.toObject(), key, starting.has(move.slug), {
					sortOrder:     i,
					compendiumId:  doc._id ?? null,
					categoryLabel: label,
				})
			)
		);
	}

	async removeCategory(key) {
		const ids = [...this._actor.items]
			.filter(i => i.type === "move" && i.system?.categoryKey === key)
			.map(i => i._id);
		if (ids.length) await this._actor.deleteEmbeddedDocuments("Item", ids);
	}

	async incrementMove(categoryKey, moveSlug) {
		await incrementMove(this._actor, categoryKey, moveSlug);
	}

	async decrementMove(categoryKey, moveSlug) {
		await decrementMove(this._actor, categoryKey, moveSlug);
	}

	async addMoveToOther(moveData) {
		const moveSlug = toSlug(moveData.name);
		const existing = [...this._actor.items].filter(i => i.type === "move" && i.system?.categoryKey === "other");
		if (existing.some(i => toSlug(i.name) === moveSlug)) return false;
		await this._actor.createEmbeddedDocuments("Item", [{
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
			i => i.type === "move" && i.system?.categoryKey === "other" && toSlug(i.name) === moveSlug
		);
		if (!item) return;
		await this._actor.deleteEmbeddedDocuments("Item", [item._id]);
	}

	async setMoveChoiceText(moveSlug, optionSlug, value) {
		const item = _findMoveItemBySlug(this._actor, moveSlug);
		if (!item?.system?.choices) return;
		await this._factory.forItem(item._id, "pickValues")
			.setText(item.system.choices.slug, optionSlug, value);
	}

	async setMoveChoiceCount(moveSlug, optionSlug, count) {
		const item = _findMoveItemBySlug(this._actor, moveSlug);
		if (!item?.system?.choices) return;
		await this._factory.forItem(item._id, "pickValues")
			.setCount(item.system.choices.slug, optionSlug, count);
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

		// Arcana mystery moves live in `arcana-<slug>` categories; they render on their arcanum card, not
		// the moves tab. They still count toward acquiredSlugs above (for other moves' requirements).
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

		const categories = await Promise.all(sortedKeys.map(async catKey => {
			const meta  = _categoryMetadata(catKey, byCatKey.get(catKey));
			const moves = await Promise.all(byCatKey.get(catKey).map(item =>
				buildMoveSnapshot(item, catKey,
					computeSelectable(item),
					_requirementsMet(item.system ?? null, level, acquiredSlugs),
					resourceController)
			));
			return new MoveCategorySnapshotBuilder()
				.withKey(meta.key).withLabel(meta.label).withRenderStyle(meta.renderStyle)
				.withAllowAdditional(meta.allowAdditional).withNote(meta.note)
				.withMoves(moves).build();
		}));
		return new MovelistBuilder().withCategories(categories).build();
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
	if (key === "special")           return 2;
	if (key === "follower")          return 3;
	if (key.startsWith("insert-")) return 4;
	if (key === "other")             return 5;
	return 6;
}

function _categoryMetadata(catKey, catItems) {
	if (catKey === "basic")    return { key: "basic",    label: "Basic Moves",    renderStyle: "side-bar", allowAdditional: false, note: null };
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

function _findMoveItemBySlug(actor, moveSlug) {
	return [...actor.items].find(
		i => i.type === "move" && (i.system?.slug ?? toSlug(i.name)) === moveSlug
	) ?? null;
}
