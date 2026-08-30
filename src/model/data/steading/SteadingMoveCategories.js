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
	//
	// `hidden` names slugs the category OWNS but does not show on the steading. The book files a move
	// by when you make it, not by who makes it, so "Homefront moves" holds both — see below.
	constructor(key, label, { order = [], hidden = [], ownTab = false } = {}) {
		this.key    = key;
		this.label  = label;
		this.order  = order;
		this.hidden = hidden;
		this.ownTab = ownTab;
	}

	/** Whether this category shows `slug` on the steading sheet. */
	shows(slug) {
		return !this.hidden.includes(slug);
	}

	// Unnamed slugs all tie at the end, so a comparator subtracting two ranks gets 0 and can fall
	// through to its alphabetical tiebreak.
	rank(slug) {
		const i = this.order.indexOf(slug);
		return i === -1 ? this.order.length : i;
	}
}

// Book I files a move by WHEN you make it, not by who makes it, so its "Homefront moves" index holds
// both the steading's moves and a character's downtime moves — Level Up among them. The pack is
// faithful to the book and stays that way; what is wrong is only where the steading sheet draws it.
//
// Level Up is a character gaining a level. Rendered in a column headed by the steading's name, over
// the steading's own ratings, it reads as the STEADING levelling up, which is not a thing. Hidden
// here rather than recategorised, so the book's own filing survives and the reason is on the record.
//
// Provisional: the wider split (Bolster, Convalesce, Make a Plan and Trade & Barter are also things a
// character does at home) is a separate piece of work.
const HOMEFRONT_HIDDEN = ["level-up"];

const _CATEGORIES = [
	new SteadingMoveCategory("homefront", "Homefront Moves", { hidden: HOMEFRONT_HIDDEN }),
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
