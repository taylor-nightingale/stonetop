// The four seasons, in the order the book prints them. One source for everything keyed by season:
// the Seasons Change move each one names, the trade-dress glyph it is bulleted with (Book I, p.85),
// the reading order the sheet and the move category both sort by, and which season follows which
// when the wheel is advanced.

export class Season {
	constructor(key) {
		this.key = key;
	}

	get moveSlug() {
		return `seasons-change-${this.key}`;
	}

	/** The season's name, as a key — it is stated as text on the ledger line, the wheel and every
	 *  turnover clause, so it is translated rather than carried around as an English string. */
	get labelKey() {
		return `stonetop.steading.seasons.names.${this.key}`;
	}

	/** The season the wheel lands on next; winter wraps to spring, which is where a year turns. */
	get next() {
		const order = Seasons.all();
		return order[(order.findIndex(s => s.key === this.key) + 1) % order.length];
	}

	/** Whether advancing PAST this season starts a new year — only winter does. */
	get endsYear() {
		return this.key === "winter";
	}
}

const _SEASONS = [
	new Season("spring"),
	new Season("summer"),
	new Season("autumn"),
	new Season("winter"),
];

export class Seasons {
	// The move category the four seasonal moves live in. Named here because the seasons ARE the
	// category — SteadingMoveCategories reads it, and nothing else needs to spell it.
	static CATEGORY = "seasons";

	// What a steading with no season stored is in.
	//
	// WINTER, so that the first thing a new steading's table does is let spring break forth — the
	// book's own opening move. Starting in spring would mean the group's first turn of the wheel took
	// them to summer, and the season the book opens on would be the one season they never rolled.
	static DEFAULT = "winter";

	static all() {
		return [..._SEASONS];
	}

	static moveSlugs() {
		return _SEASONS.map(s => s.moveSlug);
	}

	static forMoveSlug(slug) {
		return _SEASONS.find(s => s.moveSlug === slug) ?? null;
	}

	/** The season a stored key names, falling back to the default rather than to null — every caller
	 *  here is rendering or advancing, and neither has anything to do with "no season". */
	static byKey(key) {
		return _SEASONS.find(s => s.key === key) ?? _SEASONS.find(s => s.key === Seasons.DEFAULT);
	}
}
