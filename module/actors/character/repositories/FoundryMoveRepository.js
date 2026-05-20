import { MoveDefinition } from "../../../model/MoveDefinition.js";
import { FoundryPackStore } from "./FoundryPackStore.js";

const PLAYBOOK_FIELDS   = ["system.playbook", "system.isStartingMove", "system.requirement",
                            "system.rollType", "system.description", "system.repeatMax", "system.resource"];
const POST_DEATH_FIELDS = ["system.playbook", "system.rollType", "system.description", "system.resource"];

export class FoundryMoveRepository {
	constructor() {
		this._playbookStore  = new FoundryPackStore("stonetop.playbook-moves",  PLAYBOOK_FIELDS);
		this._basicStore     = new FoundryPackStore("stonetop.basic-moves",      ["system.rollType"]);
		this._postDeathStore = new FoundryPackStore("stonetop.post-death-moves", POST_DEATH_FIELDS);
		this._playbookCache  = new Map();
		this._postDeathCache = new Map();
		this._basicCache     = null;
	}

	async getPlaybookMoves(playbookName) {
		if (this._playbookCache.has(playbookName)) return this._playbookCache.get(playbookName);
		const entries = await this._playbookStore.filterEntries(e => e.system?.playbook === playbookName);
		const moves   = entries.map(e => new MoveDefinition(e));
		this._playbookCache.set(playbookName, moves);
		return moves;
	}

	async getPlaybookMoveDocument(id) {
		return this._playbookStore.getDocument(id);
	}

	async getBasicMoves() {
		if (this._basicCache) return this._basicCache;
		const entries    = await this._basicStore.getAll();
		this._basicCache = entries.map(e => new MoveDefinition(e));
		return this._basicCache;
	}

	async getBasicMoveDocument(id) {
		return this._basicStore.getDocument(id);
	}

	async getPostDeathMoves(insertSlug) {
		if (this._postDeathCache.has(insertSlug)) return this._postDeathCache.get(insertSlug);
		const entries = await this._postDeathStore.filterEntries(e => e.system?.playbook === insertSlug);
		const moves   = entries.map(e => new MoveDefinition(e));
		this._postDeathCache.set(insertSlug, moves);
		return moves;
	}

	async getPostDeathMoveDocument(id) {
		return this._postDeathStore.getDocument(id);
	}
}
