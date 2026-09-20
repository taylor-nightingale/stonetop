/**
 * One stat entry in CharacterSnapshot.stats.
 * @property {string} key    - "str" | "dex" | "int" | "wis" | "con" | "cha"
 * @property {number} value
 * @property {string} name   - e.g. "Strength"
 * @property {string} abbr   - e.g. "STR"
 * @property {string} description - what the stat covers and when to roll it (book p. 53)
 */
export class StatSnapshot {
	constructor(key, value, name, abbr, description = "") {
		this.key         = key;
		this.value       = value;
		this.name        = name;
		this.abbr        = abbr;
		this.description = description;
	}
}
