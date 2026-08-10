// The four seasons, in the order the book prints them. One source for everything keyed by season:
// the Seasons Change move each one names, the trade-dress glyph it is bulleted with (Book I, p.85),
// and the reading order the sheet and the move category both sort by.

export class Season {
	constructor(key, label) {
		this.key   = key;
		this.label = label;
	}

	get moveSlug() {
		return `seasons-change-${this.key}`;
	}

}

const _SEASONS = [
	new Season("spring", "Spring"),
	new Season("summer", "Summer"),
	new Season("autumn", "Autumn"),
	new Season("winter", "Winter"),
];

export class Seasons {
	// The move category the four seasonal moves live in. Named here because the seasons ARE the
	// category — SteadingMoveCategories reads it, and nothing else needs to spell it.
	static CATEGORY = "seasons";

	static all() {
		return [..._SEASONS];
	}

	static moveSlugs() {
		return _SEASONS.map(s => s.moveSlug);
	}

	static forMoveSlug(slug) {
		return _SEASONS.find(s => s.moveSlug === slug) ?? null;
	}
}
