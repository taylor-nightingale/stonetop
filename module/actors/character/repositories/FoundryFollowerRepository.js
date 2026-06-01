import { Follower } from "../../../model/data/character/Follower.js";
import { FoundryPackStore } from "./FoundryPackStore.js";

export class FoundryFollowerRepository {
	constructor() {
		this._store = new FoundryPackStore("stonetop.followers", ["system.slug"]);
		this._cache = new Map();
	}

	async findBySlug(slug) {
		if (this._cache.has(slug)) return this._cache.get(slug);
		const entry = await this._store.findEntry(e => e.system?.slug === slug);
		if (!entry) return null;
		const doc      = await this._store.getDocument(entry._id);
		const follower = new Follower({ name: doc.name, ...doc.system });
		this._cache.set(slug, follower);
		return follower;
	}

	async findBySlugs(slugs) {
		return (await Promise.all(slugs.map(s => this.findBySlug(s)))).filter(Boolean);
	}
}
