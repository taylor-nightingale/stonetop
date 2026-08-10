import { Seasons } from "./Seasons.js";

// The move categories a steading owns — the steading's answer to a character's basic/expedition/
// special lists. A category is a `moveType` in the moves compendium, stamped onto the seeded item as
// its `categoryKey`.
//
// A category also says WHERE it renders. Most land in the Moves tab's list; one that carries its own
// section of the book (the seasons) claims a tab of its own. Keeping that on the category is what
// lets SteadingMoves partition without anyone naming a particular key: adding a second tabbed
// category is a flag here plus the class that renders it, not an edit to the steading.

export class SteadingMoveCategory {
	// `order` names the slugs that have a meaningful reading order. Anything absent from it (a move
	// the GM dropped in, or a whole category that never had one) sorts alphabetically behind them.
	constructor(key, label, { order = [], ownTab = false } = {}) {
		this.key    = key;
		this.label  = label;
		this.order  = order;
		this.ownTab = ownTab;
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
	// The seasons run spring → winter, not A–Z: an alphabetical list would open on Autumn. The order
	// is the Seasons model's, so a season renamed there can't silently sort to the back here.
	new SteadingMoveCategory(Seasons.CATEGORY, "Seasons Change", { order: Seasons.moveSlugs(), ownTab: true }),
];

export class SteadingMoveCategories {
	static all() {
		return [..._CATEGORIES];
	}

	static byKey(key) {
		return _CATEGORIES.find(c => c.key === key) ?? null;
	}

	/** The categories the Moves tab lists — everything that hasn't claimed a tab of its own. */
	static inMovesList() {
		return _CATEGORIES.filter(c => !c.ownTab);
	}

	// Where a move belongs when it arrives without a category of its own — a drag-drop onto the
	// sheet. Homefront is the catch-all, matching where the steading's general moves live.
	static defaultCategory() {
		return _CATEGORIES[0];
	}
}
