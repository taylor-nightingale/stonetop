import { FakeWorldItemStore } from "./FakeWorldItemStore.js";

export class FakeFollowerRepository {
	_worldStore = new FakeWorldItemStore();
	_queriedSlugs = [];

	constructor(followers = []) {
		this._followers = followers;
	}

	get queriedSlugs() { return this._queriedSlugs; }

	addWorld(item) { this._worldStore.add(item); return this; }

	async findBySlugs(slugs) {
		this._queriedSlugs.push(...slugs);
		const world = await this._worldStore.filterEntries(e => slugs.includes(e.system?.slug));
		return [...this._followers.filter(f => slugs.includes(f.slug)), ...world];
	}
}
