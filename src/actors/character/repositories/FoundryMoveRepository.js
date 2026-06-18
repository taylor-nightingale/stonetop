import { Move } from "../../../model/data/Move.js";
import { FoundryPackStore } from "./FoundryPackStore.js";
import { WorldItemStore } from "./WorldItemStore.js";

const MOVE_FIELDS = ["system.playbook", "system.isStartingMove", "system.requirement",
                     "system.rollStat", "system.description", "system.repeatMax", "system.resource", "system.choices",
                     "system.moveResults", "system.moveType"];

export class FoundryMoveRepository {
	constructor() {
		this._moveStore       = new FoundryPackStore("stonetop.moves", MOVE_FIELDS);
		this._worldMoveStore  = new WorldItemStore("move");
		this._playbookCache   = new Map();
		this._insertMoveCache = new Map();
	}

	async getPlaybookMoves(playbookName) {
		if (this._playbookCache.has(playbookName)) return this._playbookCache.get(playbookName);

		const [entries, worldEntries] = await Promise.all([
			this._moveStore.filterEntries(e => e.system?.playbook === playbookName),
			this._worldMoveStore.filterEntries(
				e => e.system?.moveType === "playbook" && e.system?.playbook === playbookName
			),
		]);

		const moves = this.sortPlaybookMoves([...entries, ...worldEntries].map(e => new Move(e)));
		this._playbookCache.set(playbookName, moves);
		return moves;
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
			result.push(...this._sortGroup(groups.get(level), new Set(groups.get(level).map(m => m.name))));
		}
		return result;
	}

	_sortGroup(moves, groupNames) {
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

	async getPlaybookMoveDocument(id) {
		return this._moveStore.getDocument(id);
	}

	async getMovesByType(moveType) {
		const [entries, worldEntries] = await Promise.all([
			this._moveStore.filterEntries(e => e.system?.moveType === moveType),
			this._worldMoveStore.filterEntries(e => e.system?.moveType === moveType),
		]);
		return [...entries, ...worldEntries].map(e => new Move(e));
	}

	async getBasicMoves() {
		return this.getMovesByType("basic");
	}

	async getBasicMoveDocument(id) {
		return await this._moveStore.getDocument(id) ?? await this._worldMoveStore.getDocument(id);
	}

	async getInsertMoves(insertSlug) {
		if (this._insertMoveCache.has(insertSlug)) return this._insertMoveCache.get(insertSlug);
		// An insert's moves are moves tagged `system.playbook === <insert slug>`. Look in BOTH the
		// compendium and the world (custom inserts authored in Foundry tag world moves), like
		// getPlaybookMoves does.
		const [entries, worldEntries] = await Promise.all([
			this._moveStore.filterEntries(e => e.system?.playbook === insertSlug),
			this._worldMoveStore.filterEntries(e => e.system?.playbook === insertSlug),
		]);
		const moves = [...entries, ...worldEntries].map(e => new Move(e));
		this._insertMoveCache.set(insertSlug, moves);
		return moves;
	}

	// Resolve referenced moves (custom inserts store a `system.moves` list of slugs) to Move objects,
	// across both stores. Unknown slugs are dropped. Preserves the requested order.
	async getMovesBySlugs(slugs = []) {
		if (!slugs?.length) return [];
		const index = await this.buildSlugIndex();
		return slugs.map(s => index.get(s)).filter(Boolean);
	}

	async getInsertMoveDocument(id) {
		// Insert moves can be compendium OR world items; try the pack, fall back to the world.
		let doc = null;
		try { doc = await this._moveStore.getDocument(id); } catch { /* not a compendium id */ }
		return doc ?? this._worldMoveStore.getDocument(id);
	}

	async buildSlugIndex() {
		const [all, world] = await Promise.all([
			this._moveStore.getAll(),
			this._worldMoveStore.getAll(),
		]);
		return new Map([...all, ...world].map(e => new Move(e)).map(m => [m.slug, m]));
	}
}
