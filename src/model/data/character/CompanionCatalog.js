/**
 * The animal-companion stat blocks a follower offers — the Ranger's Bird / Critter / Brute /
 * Predator / Steed and anything a world authors alongside them.
 *
 * A type is identified by its `slug` and only ever displayed by its `name`. The name is prose: a
 * translation rewrites it, and a GM editing the catalog can retype it, so a pick stored as a name
 * stops resolving and silently loses the type's pickCount and pre-checked defaults. Every lookup
 * here goes through the slug; `typeFor` still accepts a name so a pick stored before that rule
 * existed keeps resolving, and so the combobox — which shows names — can hand one back.
 */
export class CompanionCatalog {
	static fromCompanion(companion) {
		return new CompanionCatalog(Array.isArray(companion?.catalog) ? companion.catalog : []);
	}

	constructor(types = []) {
		this._types = [...types];
	}

	get isEmpty() { return this._types.length === 0; }

	/** The display labels, in catalog order — what the Type combobox offers. */
	get names() { return this._types.map(t => t.name); }

	/** The type a stored pick or a typed label stands for, or null when it names nothing here. */
	typeFor(value) {
		if (!value) return null;
		return this._types.find(t => t.slug === value)
			?? this._types.find(t => t.name === value)
			?? null;
	}

	/** What to STORE for a pick — the slug — or null when the value names no type. */
	slugFor(value) {
		return this.typeFor(value)?.slug ?? null;
	}

	/** What to DISPLAY for a stored pick. Falls back to the stored value so nothing renders blank. */
	nameFor(value) {
		return this.typeFor(value)?.name ?? value ?? null;
	}
}
