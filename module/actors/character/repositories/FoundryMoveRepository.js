import { MoveDefinition } from "../../../model/MoveDefinition.js";
import { FoundryPackStore } from "./FoundryPackStore.js";

const PLAYBOOK_FIELDS   = ["system.playbook", "system.isStartingMove", "system.requirement",
                            "system.rollType", "system.description", "system.repeatMax", "system.resource",
                            "system.hpBonus", "system.armorBonus", "system.loadBonus", "system.markOptions", "system.asterisk"];
const POST_DEATH_FIELDS = ["system.playbook", "system.rollType", "system.description", "system.resource"];

export class FoundryMoveRepository {
	constructor() {
		this._playbookStore  = new FoundryPackStore("stonetop.stonetop-items", PLAYBOOK_FIELDS);
		this._basicStore     = new FoundryPackStore("stonetop.stonetop-items", ["system.moveType", "system.rollType", "system.description"]);
		this._postDeathStore = new FoundryPackStore("stonetop.stonetop-items", POST_DEATH_FIELDS);
		this._playbookCache    = new Map();
		this._postDeathCache   = new Map();
		this._basicCache       = null;
		this._expeditionCache  = null;
		this._typeCache        = new Map();
	}

	// Generic by-moveType lookup against the items pack — used for the universal SPECIAL / FOLLOWER
	// reference moves, which the fork never seeds onto a character (ensureStartingMoves seeds only
	// playbook + basic + expedition) and so has no dedicated getter for. Read-only; cached per type.
	async getMovesByType(type) {
		if (this._typeCache.has(type)) return this._typeCache.get(type);
		const entries = await this._basicStore.filterEntries(e => e.system?.moveType === type);
		const moves   = entries.map(e => new MoveDefinition(e));
		this._typeCache.set(type, moves);
		return moves;
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
		const entries    = await this._basicStore.filterEntries(e => e.system?.moveType === "basic");
		this._basicCache = entries.map(e => new MoveDefinition(e));
		return this._basicCache;
	}

	async getBasicMoveDocument(id) {
		return this._basicStore.getDocument(id);
	}

	async getExpeditionMoves() {
		if (this._expeditionCache) return this._expeditionCache;
		const entries         = await this._basicStore.filterEntries(e => e.system?.moveType === "expedition");
		this._expeditionCache = entries.map(e => new MoveDefinition(e));
		return this._expeditionCache;
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
