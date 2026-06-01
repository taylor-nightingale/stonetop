export class FakeFollowerRepository {
	constructor(followers = []) {
		this._followers = followers;
	}

	async findBySlugs(slugs) {
		return this._followers.filter(f => slugs.includes(f.slug));
	}
}
