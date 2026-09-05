/**
 * What has to be true for one of an improvement's results to hold.
 *
 * The book states these in prose above each list — "Requires all of the following:", "Requires 1 of
 * the following:", "any 3 of the following:", "Requires either this: … Or all of these:" — and the
 * pack rows record only the boxes, not the rule. So completion was computed as "every box ticked",
 * which is wrong wherever the book says "N of": Greater Harvest is done at 1 of 2 and could never
 * read so.
 *
 * ONE expression language, used for two things that turned out to be the same thing:
 *
 *   - whether the improvement is BUILT (the requirement of its on-completion result), and
 *   - whether a particular result holds — Well-Trained Militia's "+1 Defenses" needs the veteran
 *     warrior AND two or more trained tactics, while its summer upkeep needs only the warrior.
 *
 * That is why completion is not modelled separately: it is just one result's requirement. It is also
 * why "if you cease to meet the requirements, decrease Prosperity by 1" needs no trigger of its own —
 * a lapse is this expression going false again.
 *
 *   "veteran-warrior"                                   a row, ticked through
 *   { all: [...] }                                      every term
 *   { any: 2, of: [...] }                               at least two of them
 *   { any: 1, of: ["swords", { all: [...] }] }          Weapons of War, nested
 */

/** A single requirement row, satisfied when its track is filled. */
export class RequirementRow {
	constructor(slug) {
		this.slug = slug;
	}

	isMet(boxes)      { return boxes.isFull(this.slug); }
	/** Boxes that must be ticked to satisfy this — the row's own track length. */
	neededIn(boxes)   { return boxes.sizeOf(this.slug); }
	tickedIn(boxes)   { return Math.min(boxes.countOf(this.slug), boxes.sizeOf(this.slug)); }
	get rows()        { return [this.slug]; }
}

/** Every term. */
export class AllOf {
	constructor(terms) {
		this.terms = terms;
	}

	isMet(boxes)    { return this.terms.every(t => t.isMet(boxes)); }
	neededIn(boxes) { return this.terms.reduce((n, t) => n + t.neededIn(boxes), 0); }
	tickedIn(boxes) { return this.terms.reduce((n, t) => n + t.tickedIn(boxes), 0); }
	get rows()      { return this.terms.flatMap(t => t.rows); }
}

/**
 * At least `count` of the terms.
 *
 * The meter counts the CHEAPEST way to satisfy it — "1 of these two" needs one box, not two — so a
 * reader sees how far off they are rather than a denominator the book never asked for. Progress is
 * capped at that: ticking both branches of an either/or is allowed (nothing here enforces), but it
 * must not read as 2 of 1.
 */
export class AnyOf {
	constructor(count, terms) {
		this.count = count;
		this.terms = terms;
	}

	isMet(boxes) {
		return this.terms.filter(t => t.isMet(boxes)).length >= this.count;
	}

	neededIn(boxes) {
		return this.terms
			.map(t => t.neededIn(boxes))
			.sort((a, b) => a - b)
			.slice(0, this.count)
			.reduce((n, x) => n + x, 0);
	}

	tickedIn(boxes) {
		const progress = this.terms.map(t => t.tickedIn(boxes)).sort((a, b) => b - a);
		return Math.min(
			progress.slice(0, this.count).reduce((n, x) => n + x, 0),
			this.neededIn(boxes),
		);
	}

	get rows() { return this.terms.flatMap(t => t.rows); }
}

/**
 * The tick state an expression is evaluated against: how many boxes a row has, and how many are
 * ticked. Kept as its own small type so the expression never reaches into a values map or a choice
 * group — it is handed the two questions it can ask.
 */
export class RequirementBoxes {
	/**
	 * @param sizes  slug → how many boxes that row has
	 * @param counts slug → how many are ticked
	 */
	constructor(sizes = {}, counts = {}) {
		this._sizes  = sizes;
		this._counts = counts;
	}

	sizeOf(slug)  { return this._sizes[slug] ?? 1; }
	countOf(slug) { return this._counts[slug] ?? 0; }
	isFull(slug)  { return this.countOf(slug) >= this.sizeOf(slug); }

	/** Built from an improvement's choice rows and the steading's stored values for that group. */
	static from(choiceList = [], storedValues = {}) {
		const sizes = {}, counts = {};
		for (const row of choiceList) {
			if (!row?.slug || !row?.track) continue;
			sizes[row.slug]  = row.track.max ?? 1;
			counts[row.slug] = storedValues[row.slug] ?? 0;
		}
		return new RequirementBoxes(sizes, counts);
	}
}

/** Parse the authored form. A bare string is a row; `{all}` and `{any, of}` nest freely. */
export function parseRequirement(raw) {
	if (typeof raw === "string") return new RequirementRow(raw);
	if (Array.isArray(raw))      return new AllOf(raw.map(parseRequirement));
	if (raw && Array.isArray(raw.all)) return new AllOf(raw.all.map(parseRequirement));
	if (raw && Array.isArray(raw.of)) {
		const terms = raw.of.map(parseRequirement);
		// `any` without a number means one of them, which is how the book's "either one of these"
		// and "1 of the following" both read.
		const count = Number.isInteger(raw.any) ? raw.any : 1;
		return new AnyOf(Math.min(Math.max(count, 1), terms.length), terms);
	}
	// Nothing required — a result that simply holds once the improvement exists.
	return new AllOf([]);
}
