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

const EVERY_SEASON = Seasons.all().map(s => s.key);

const _MOMENTS = [
	new Moment("autumn-harvest", ["autumn"]),
	new Moment("aurochs-hunt",   ["spring"]),
	// The Inn's "once per season, when you expend 1 Surplus and bring folks together at the inn".
	// A moment rather than a fourth kind of trigger, because it already IS one in every respect that
	// matters: a named occasion inside a season, which the sheet cannot see coming and the table
	// declares by applying it. The only thing that separates it from the harvest is that it can
	// happen in any season rather than only autumn — which is what `seasons` is for.
	//
	// "Once per season" needs no modelling either: applyMoment refuses a second apply and
	// turnoverApplied is cleared when the wheel turns, so once-per-season is what a moment already
	// means. The autumn harvest happens once per autumn on the same mechanism.
	new Moment("inn-gathering", EVERY_SEASON),
];

export class Moments {
	static all() { return [..._MOMENTS]; }

	static byKey(key) { return _MOMENTS.find(m => m.key === key) ?? null; }

	static has(key) { return _MOMENTS.some(m => m.key === key); }

	/** The moments that can occur in a season, in registry order. */
	static inSeason(season) { return _MOMENTS.filter(m => m.occursIn(season)); }
}
