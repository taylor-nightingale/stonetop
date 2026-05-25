import { FoundryPackStore } from "../../character/repositories/FoundryPackStore.js";

const FIELDS = ["flags.stonetop.slug", "flags.stonetop.sortOrder", "flags.stonetop.choices"];

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
			.sort((a, b) => (a.flags?.stonetop?.sortOrder ?? 0) - (b.flags?.stonetop?.sortOrder ?? 0))
			.map(entry => {
				const st = entry.flags?.stonetop ?? {};
				return new SteadingImprovement(st.slug, st.choices ?? null);
			});
		return this._cache;
	}
}
