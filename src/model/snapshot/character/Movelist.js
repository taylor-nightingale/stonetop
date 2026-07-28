/**
 * @property {MoveCategorySnapshot[]} categories - ordered list of move categories (the moves tab)
 * @property {Object<string, MoveSnapshot>} bySlug - every owned move shaped once, keyed by slug —
 *   the registry an inline move grant (in any choice row) resolves against at render, mirroring
 *   `followers.bySlug`. Includes arcana-<slug> moves that are kept off the tab.
 */
export class Movelist {
	constructor(b) {
		this.categories = b._categories;
		this.bySlug     = b._bySlug ?? {};
	}
}

export class MovelistBuilder {
	withCategories(v) { this._categories = v; return this; }
	withBySlug(v)     { this._bySlug     = v; return this; }
	build()           { return new Movelist(this); }
}
