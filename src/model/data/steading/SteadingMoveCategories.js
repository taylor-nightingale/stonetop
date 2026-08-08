// The move categories a steading renders on its Moves tab — the steading's answer to a character's
// basic/expedition/special lists. A category is a `moveType` in the moves compendium, stamped onto
// the seeded item as its `categoryKey`; the sheet emits one move group per category.

export class SteadingMoveCategory {
	// `order` names the slugs that have a meaningful reading order. Anything absent from it (a move
	// the GM dropped in, or a whole category that never had one) sorts alphabetically behind them.
	constructor(key, label, order = []) {
		this.key   = key;
		this.label = label;
		this.order = order;
	}

	// Unnamed slugs all tie at the end, so a comparator subtracting two ranks gets 0 and can fall
	// through to its alphabetical tiebreak.
	rank(slug) {
		const i = this.order.indexOf(slug);
		return i === -1 ? this.order.length : i;
	}
}

const _CATEGORIES = [
	new SteadingMoveCategory("homefront", "Homefront Moves"),
	// The seasons run spring → winter, not A–Z: an alphabetical list would open on Autumn.
	new SteadingMoveCategory("seasons", "Seasons Change", [
		"seasons-change-spring",
		"seasons-change-summer",
		"seasons-change-autumn",
		"seasons-change-winter",
	]),
];

export class SteadingMoveCategories {
	static all() {
		return [..._CATEGORIES];
	}

	static byKey(key) {
		return _CATEGORIES.find(c => c.key === key) ?? null;
	}

	// Where a move belongs when it arrives without a category of its own — a drag-drop onto the
	// sheet. Homefront is the catch-all, matching where the steading's general moves live.
	static defaultCategory() {
		return _CATEGORIES[0];
	}
}
