import { Move } from "../../../model/data/Move.js";
import { FoundryPackStore } from "./FoundryPackStore.js";
import { WorldItemStore } from "./WorldItemStore.js";

const PLAYBOOK_FIELDS   = ["system.playbook", "system.isStartingMove", "system.requirement",
                            "system.rollStat", "system.description", "system.repeatMax", "system.resource", "system.choices",
                            "system.moveResults"];
const POST_DEATH_FIELDS = ["system.playbook", "system.rollStat", "system.description", "system.resource", "system.moveResults"];
const SLUG_INDEX_FIELDS = ["system.playbook", "system.isStartingMove", "system.requirement",
                            "system.rollStat", "system.description", "system.repeatMax", "system.resource", "system.choices",
                            "system.moveResults", "system.moveType"];

export class FoundryMoveRepository {
	constructor() {
		this._playbookStore   = new FoundryPackStore("stonetop.playbook-moves",  PLAYBOOK_FIELDS);
		this._basicStore      = new FoundryPackStore("stonetop.basic-moves",      SLUG_INDEX_FIELDS);
		this._postDeathStore  = new FoundryPackStore("stonetop.post-death-moves", POST_DEATH_FIELDS);
		this._specialStore    = new FoundryPackStore("stonetop.special-moves",    SLUG_INDEX_FIELDS);
		this._homefrontStore  = new FoundryPackStore("stonetop.homefront-moves",  SLUG_INDEX_FIELDS);
		this._followerMvStore = new FoundryPackStore("stonetop.follower-moves",   SLUG_INDEX_FIELDS);
		this._worldMoveStore  = new WorldItemStore("move");
		this._playbookCache   = new Map();
		this._postDeathCache  = new Map();
	}

	async getPlaybookMoves(playbookName) {
		if (this._playbookCache.has(playbookName)) return this._playbookCache.get(playbookName);

		const [entries, worldEntries] = await Promise.all([
			this._playbookStore.filterEntries(e => e.system?.playbook === playbookName),
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
		return this._playbookStore.getDocument(id);
	}

	async getBasicMoves() {
		const [entries, worldEntries] = await Promise.all([
			this._basicStore.getAll(),
			this._worldMoveStore.filterEntries(e => e.system?.moveType === "basic"),
		]);
		return [...entries, ...worldEntries].map(e => new Move(e));
	}

	async getBasicMoveDocument(id) {
		return await this._basicStore.getDocument(id) ?? await this._worldMoveStore.getDocument(id);
	}

	async getPostDeathMoves(insertSlug) {
		if (this._postDeathCache.has(insertSlug)) return this._postDeathCache.get(insertSlug);
		const entries = await this._postDeathStore.filterEntries(e => e.system?.playbook === insertSlug);
		const moves   = entries.map(e => new Move(e));
		this._postDeathCache.set(insertSlug, moves);
		return moves;
	}

	async getPostDeathMoveDocument(id) {
		return this._postDeathStore.getDocument(id);
	}

	async buildSlugIndex() {
		const [playbook, basic, postDeath, special, homefront, followerMv, world] = await Promise.all([
			this._playbookStore.getAll(),
			this._basicStore.getAll(),
			this._postDeathStore.getAll(),
			this._specialStore.getAll(),
			this._homefrontStore.getAll(),
			this._followerMvStore.getAll(),
			this._worldMoveStore.getAll(),
		]);
		const all = [...playbook, ...basic, ...postDeath, ...special, ...homefront, ...followerMv, ...world]
			.map(e => new Move(e));
		return new Map(all.map(m => [m.slug, m]));
	}
}
