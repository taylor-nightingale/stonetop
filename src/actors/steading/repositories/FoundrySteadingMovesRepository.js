import { FoundryPackStore } from "../../character/repositories/FoundryPackStore.js";

const FIELDS = ["system.moveType", "system.rollStat", "system.description", "system.resource", "system.slug", "name"];

export class FoundrySteadingMove {
	constructor(id, name, moveType, rollStat, description, resource, slug) {
		this.id          = id;
		this.name        = name;
		this.moveType    = moveType;
		this.rollStat    = rollStat || null;
		this.description = description || "";
		this.resource    = resource || null;
		this.slug        = slug || null;
	}
}

export class FoundrySteadingMovesRepository {
	constructor() {
		this._store = new FoundryPackStore("stonetop.moves", FIELDS);
		this._cache = null;
	}

	async getHomefrontMoves() {
		if (this._cache) return this._cache;
		const entries = await this._store.getAll();
		this._cache = entries
			.filter(e => e.system?.moveType === "homefront")
			.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
			.map(e => new FoundrySteadingMove(
				e._id,
				e.name,
				e.system?.moveType,
				e.system?.rollStat,
				e.system?.description,
				e.system?.resource,
				e.system?.slug,
			));
		return this._cache;
	}
}
