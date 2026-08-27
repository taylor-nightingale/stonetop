import { GrantSource, ItemGrant, ItemGrantSet } from "../../model/data/ItemGrant.js";
import { ReferenceMoveSeeder } from "../ReferenceMoveSeeder.js";
import { decrementMove, incrementMove, withCategoryFields } from "../embeddedMoves.js";


/**
 * Which move items a character owns, and why.
 *
 * Split out of CharacterMoves because the two have different collaborators: granting needs the
 * catalog, the actor and the one granted-items writer — nothing more. Presenting a move additionally
 * needs a resource controller, a choice factory and the requirement policy. The migrations want only
 * this half, and used to get the whole class with `null` in the slots they did not need.
 */
export class CharacterMoveGrants {
	constructor(moveRepo, actor, grantedItems) {
		this._moveRepo     = moveRepo;
		this._actor        = actor;
		this._grantedItems = grantedItems;
		this._seeder       = new ReferenceMoveSeeder(actor, moveRepo, grantedItems);
	}

	// Reference moves are seeded onto every character and shown in the sidebar (not the moves
	// tab): basic, plus the expedition, universal special, and follower moves. Seeded once at actor
	// creation (CreateActor hook), NOT on render — thereafter they are ordinary owned items the GM
	// can edit, delete, or re-add via drag-drop. One list, so a category added to the packs later
	// reaches both new characters (here) and existing ones (migrateReferenceMoveCategories).
	static REFERENCE_CATEGORIES = ["basic", "expedition", "special", "follower"];

	async initBasicMoves() {
		for (const moveType of CharacterMoveGrants.REFERENCE_CATEGORIES) {
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
