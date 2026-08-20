import { Move } from "../../../model/data/Move.js";
import { FoundryPackStore } from "./FoundryPackStore.js";
import { WorldItemStore } from "./WorldItemStore.js";

const MOVE_FIELDS = ["system.requirement", "system.rollStat", "system.description",
                     "system.repeatMax", "system.resource", "system.choices",
                     "system.moveResults", "system.moveType"];

export class FoundryMoveRepository {
	constructor() {
		this._moveStore      = new FoundryPackStore("stonetop.moves", MOVE_FIELDS);
		this._worldMoveStore = new WorldItemStore("move");
	}

	async getMovesByType(moveType) {
		const [entries, worldEntries] = await Promise.all([
			this._moveStore.filterEntries(e => e.system?.moveType === moveType),
			this._worldMoveStore.filterEntries(e => e.system?.moveType === moveType),
		]);
		return [...entries, ...worldEntries].map(e => new Move(e));
	}

	// Reference moves (basic/special/follower/homefront) are compendium content seeded onto every
	// actor at creation. Read them from the pack ONLY: a world-item copy of a pack move (e.g. one
	// dragged out of the compendium into the Items directory) is not a distinct move, and merging
	// it in would seed the same slug twice. Homebrew/custom moves reach an actor through drag-drop,
	// not this reference seed — so the pack is the single, slug-unique source of the starting set.
	async getReferenceMovesByType(moveType) {
		const entries = await this._moveStore.filterEntries(e => e.system?.moveType === moveType);
		return entries.map(e => new Move(e));
	}

	async getBasicMoves() {
		return this.getMovesByType("basic");
	}

	// Resolve referenced moves (playbook/insert `moves`, arcana `back.moveSlugs`) to Move objects,
	// across compendium + world. Unknown slugs are dropped. Preserves the requested order.
	async getMovesBySlugs(slugs = []) {
		if (!slugs?.length) return [];
		const index = await this.buildSlugIndex();
		return slugs.map(s => index.get(s)).filter(Boolean);
	}

	// Item-shaped index entries ({ _id, name, img, system }) for the given slugs, across compendium +
	// world — order-preserving, unknowns dropped. Unlike getMovesBySlugs (flat Move models, for name
	// chips), these feed buildMoveSnapshot to render full move CARDS in an item-sheet preview.
	async getMoveEntriesBySlugs(slugs = []) {
		if (!slugs?.length) return [];
		const [all, world] = await Promise.all([
			this._moveStore.getAll(),
			this._worldMoveStore.getAll(),
		]);
		const bySlug = new Map();
		for (const entry of [...all, ...world]) {
			const slug = new Move(entry).slug;
			if (slug && !bySlug.has(slug)) bySlug.set(slug, entry);
		}
		return slugs.map(s => bySlug.get(s)).filter(Boolean);
	}

	// Fetch the full document for a referenced move (compendium OR world), so it can be embedded onto
	// an actor. Try the pack, fall back to the world.
	async getReferencedMoveDocument(id) {
		let doc = null;
		try { doc = await this._moveStore.getDocument(id); } catch { /* not a compendium id */ }
		return doc ?? this._worldMoveStore.getDocument(id);
	}

	// Resolve a move to its full document by slug (compendium first, then world), so a sheet can open
	// a move that a rule reference names by slug rather than by id.
	async getMoveDocumentBySlug(slug) {
		const [entry] = await this.getMoveEntriesBySlugs([slug]);
		return entry ? this.getReferencedMoveDocument(entry._id) : null;
	}

	async buildSlugIndex() {
		const [all, world] = await Promise.all([
			this._moveStore.getAll(),
			this._worldMoveStore.getAll(),
		]);
		return new Map([...all, ...world].map(e => new Move(e)).map(m => [m.slug, m]));
	}
}
