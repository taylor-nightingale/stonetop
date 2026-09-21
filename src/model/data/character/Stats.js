/**
 * The six, written down once.
 *
 * Exported because two other places need to know exactly this set and had each restated it:
 * `CharacterStats` builds a snapshot entry per stat, and the move sheet offers each of them as a
 * "+STR" roll choice while the steading's ratings beside them take no plus. A second copy of the
 * list is a seventh stat that appears in one of those places and not the others.
 */
export const STAT_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

export class Stats {
	constructor(values = {}) {
		for (const key of STAT_KEYS) {
			this[key] = values[key] ?? 0;
		}
	}

	get(key) {
		return this[key] ?? 0;
	}
}
