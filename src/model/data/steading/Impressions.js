/**
 * What a steading is like in a given season, in the book's own words.
 *
 * Book II's village articles print a short list of sensory lines per season under "Impressions" —
 * "Petrichor smell on a southerly breeze", "Cloaks drawn tight against a bitter wind". They are
 * lifted into the steadfast at pack-build time (scripts/import/build-steading-impressions.js) and
 * copied onto a steading when the steadfast is applied, so the sheet never invents a sentence and
 * never reaches into a compendium to render one.
 *
 * Most steadings have none: only articles that print the section have any, which is ordinary.
 */
export class Impression {
	constructor(season, text) {
		this.season = season;
		this.text   = text;
	}
}

export class Impressions {
	constructor(rows = []) {
		this._rows = rows;
	}

	static fromRaw(raw) {
		return new Impressions((Array.isArray(raw) ? raw : [])
			.filter(row => typeof row?.season === "string" && typeof row?.text === "string" && row.text.trim())
			.map(row => new Impression(row.season, row.text)));
	}

	get isEmpty() {
		return this._rows.length === 0;
	}

	/** The lines for one Season, in the order the book prints them. */
	forSeason(season) {
		return this._rows.filter(row => row.season === season.key).map(row => row.text);
	}

	/**
	 * One line for the season, chosen at random — what the turn of the wheel stamps on the steading.
	 *
	 * The chooser is injected so the pick is testable and so nothing here depends on a global. Null
	 * when the steading has no impressions for that season, which the caller renders as nothing
	 * rather than as a blank quotation.
	 */
	pickFor(season, random = Math.random) {
		const lines = this.forSeason(season);
		return lines.length ? lines[Math.floor(random() * lines.length) % lines.length] : null;
	}
}
