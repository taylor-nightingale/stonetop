/**
 * @property {MoveCategorySnapshot[]} categories - ordered list of move categories
 */
export class Movelist {
	constructor(b) {
		this.categories = b._categories;
	}
}

export class MovelistBuilder {
	withCategories(v) { this._categories = v; return this; }
	build()           { return new Movelist(this); }
}
