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

	// The item-shaped resolver GrantRegistry reads — distinct from findBySlugs, which answers with the
	// flat model. The real repository fetches full documents because a follower's index projects only
	// its slug; a fixture's followers are already whole items, so there is nothing to fetch.
	async getFollowerDocsBySlugs(slugs = []) {
		if (!slugs?.length) return [];
		const world = await this._worldStore.filterEntries(e => slugs.includes(e.system?.slug));
		return [...this._followers.filter(f => slugs.includes(f.system?.slug ?? f.slug)), ...world];
	}
}
