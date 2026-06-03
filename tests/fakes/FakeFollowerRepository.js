import { FakeWorldItemStore } from "./FakeWorldItemStore.js";

export class FakeFollowerRepository {
	_worldStore = new FakeWorldItemStore();

	constructor(followers = []) {
		this._followers = followers;
	}

	addWorld(item) { this._worldStore.add(item); return this; }

	async findBySlugs(slugs) {
		const world = await this._worldStore.filterEntries(e => slugs.includes(e.system?.slug));
		return [...this._followers.filter(f => slugs.includes(f.slug)), ...world];
	}
}
