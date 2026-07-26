export class FakeFollowers {
	constructor() {
		this._owned = new Map();   // slug -> { showOnTab }
	}

	async addFollower(slug, { showOnTab = true } = {}) { this._owned.set(slug, { showOnTab }); }
	async removeFollower(slug) { this._owned.delete(slug); }

	isOwned(slug)   { return this._owned.has(slug); }
	showOnTab(slug) { return this._owned.get(slug)?.showOnTab ?? null; }
	get owned()     { return [...this._owned.keys()]; }
}
