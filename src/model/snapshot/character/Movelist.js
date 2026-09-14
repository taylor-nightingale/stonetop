/**
 * @property {MoveCategorySnapshot[]} categories - ordered list of move categories (the moves tab)
 * @property {Object<string, MoveSnapshot>} bySlug - every move the sheet can DRAW, shaped once and
 *   keyed by slug — the registry an inline move grant (in any choice row) resolves against at render,
 *   mirroring `followers.bySlug`. Includes arcana-<slug> moves that are kept off the tab.
 *
 *   Not the same set as the moves the character owns, and the difference is the point: the playbook
 *   tab draws every background, taken or not, because that is how a reader decides between them — so
 *   a background's moves have to resolve before it is chosen. This said "every owned move" and was
 *   built that way, which left those rows rendering empty until the choice they were there to inform
 *   had already been made. An owned move still wins on a slug collision: it is the one carrying the
 *   item id the die rolls against.
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
