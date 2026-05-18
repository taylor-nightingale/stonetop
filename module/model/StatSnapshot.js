/**
 * One stat entry in CharacterSnapshot.stats.
 * @property {number} value
 * @property {string} name - e.g. "Strength"
 * @property {string} abbr - e.g. "STR"
 */
export class StatSnapshot {
	constructor(value, name, abbr) {
		this.value = value;
		this.name  = name;
		this.abbr  = abbr;
	}
}
