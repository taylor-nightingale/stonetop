export class FakeFollowers {
	constructor() {
		this._owned = new Set();
	}

	async addFollower(slug)    { this._owned.add(slug); }
	async removeFollower(slug) { this._owned.delete(slug); }

	isOwned(slug) { return this._owned.has(slug); }
	get owned()   { return [...this._owned]; }
}
