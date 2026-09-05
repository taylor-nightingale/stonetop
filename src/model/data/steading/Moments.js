import { Seasons } from "./Seasons.js";

/**
 * A named point WITHIN a season at which an improvement's result can fire.
 *
 * The wheel turning is not the only thing that happens in a season. "When the autumn harvest is
 * complete" fires during autumn, not when autumn arrives — so a mill that pays out the moment the
 * season changes pays out too early. The sheet cannot know when the harvest happened; the table
 * says so by triggering the moment.
 *
 * Deliberately tiny, and not a registry of which improvement grants which: a moment appears on the
 * tab when some BUILT improvement has a result at it, which falls out of the effect data.
 */
export class Moment {
	constructor(key, seasons) {
		this.key     = key;
		this.seasons = seasons;
	}

	get labelKey() { return `stonetop.steading.seasons.moments.${this.key}`; }

	/** Whether this moment can occur in the given Season. */
	occursIn(season) { return this.seasons.includes(season?.key); }
}

const _MOMENTS = [
	new Moment("autumn-harvest", ["autumn"]),
	new Moment("aurochs-hunt",   ["spring"]),
];

export class Moments {
	static all() { return [..._MOMENTS]; }

	static byKey(key) { return _MOMENTS.find(m => m.key === key) ?? null; }

	static has(key) { return _MOMENTS.some(m => m.key === key); }

	/** The moments that can occur in a season, in registry order. */
	static inSeason(season) { return _MOMENTS.filter(m => m.occursIn(season)); }

	/** Every season named by any moment — what the review file checks a season key against. */
	static seasonKeys() {
		return Seasons.all().filter(s => _MOMENTS.some(m => m.occursIn(s))).map(s => s.key);
	}
}
