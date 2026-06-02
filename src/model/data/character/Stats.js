const _STAT_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

export class Stats {
	constructor(values = {}) {
		for (const key of _STAT_KEYS) {
			this[key] = values[key] ?? 0;
		}
	}

	get(key) {
		return this[key] ?? 0;
	}
}
