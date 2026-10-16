/**
 * A named point WITHIN a season at which an improvement's result can fire.
 *
 * The wheel turning is not the only thing that happens in a season. "When the autumn harvest is
 * complete" fires during autumn, not when autumn arrives — so a mill that pays out the moment the
 * season changes pays out too early. The sheet cannot know when the harvest happened; the table
 * says so by triggering the moment.
 *
 * Nothing in code lists the moments or their seasons. Each result that fires at a moment names it
 * (by slug, so results from different improvements meet at one) and the seasons it can happen in;
 * a moment is whatever the results say it is. The book's three are named in the language files by
 * that slug, which the season moves name too; one an author makes up carries its own words.
 */
export class Moment {
	constructor(key, { name = null, seasons = [] } = {}) {
		this.key     = key;
		this.name    = name;
		this.seasons = seasons;
	}

	/** The translation key for one of the book's moments; null for one its author named. */
	get labelKey() { return this.name === null ? Moment.labelKeyFor(this.key) : null; }

	static labelKeyFor(key) { return `stonetop.steading.seasons.moments.${key}`; }

	/** Whether this moment can occur in the given Season. */
	occursIn(season) { return Boolean(season) && this.seasons.includes(season.key); }
}

export class Moments {
	constructor(moments = []) {
		this._moments = moments;
	}

	/** The moments these triggers fire at, once each, with every season any of them names. */
	static fromTriggers(triggers) {
		const byKey = new Map();
		for (const trigger of triggers) {
			if (trigger?.kind !== "moment" || !trigger.moment) continue;
			const known = byKey.get(trigger.moment) ?? { name: null, seasons: [] };
			known.name ??= trigger.momentName ?? null;
			for (const season of trigger.seasons) if (!known.seasons.includes(season)) known.seasons.push(season);
			byKey.set(trigger.moment, known);
		}
		return new Moments([...byKey].map(([key, { name, seasons }]) => new Moment(key, { name, seasons })));
	}

	all() { return [...this._moments]; }

	byKey(key) { return this._moments.find(m => m.key === key) ?? null; }

	/** The moments that can occur in a season, in the order the results name them. */
	inSeason(season) { return this._moments.filter(m => m.occursIn(season)); }
}
