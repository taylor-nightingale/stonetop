import { FoundryPackStore } from "../../character/repositories/FoundryPackStore.js";

const FIELDS = ["system.slug", "system.sortOrder", "system.choices"];

export class SteadingImprovement {
	constructor(slug, choices) {
		this.slug    = slug;
		this.choices = choices;
	}
}

export class FoundrySteadingImprovementRepository {
	constructor() {
		this._store = new FoundryPackStore("stonetop.steading-improvements", FIELDS);
		this._cache = null;
	}

	async getAll() {
		if (this._cache) return this._cache;
		const entries = await this._store.getAll();
		this._cache = entries
			.filter(e => e.type === "improvement")
			.sort((a, b) => (a.system?.sortOrder ?? 0) - (b.system?.sortOrder ?? 0))
			.map(entry => new SteadingImprovement(entry.system?.slug, entry.system?.choices ?? null));
		return this._cache;
	}
}
