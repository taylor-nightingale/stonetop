import { Follower } from "../../../model/data/character/Follower.js";
import { FoundryPackStore } from "./FoundryPackStore.js";
import { WorldItemStore } from "./WorldItemStore.js";
import { summarizeEntries } from "./referenceSummaries.js";

export class FoundryFollowerRepository {
	constructor() {
		this._store      = new FoundryPackStore("stonetop.followers", ["system.slug"]);
		this._worldStore = new WorldItemStore("follower");
		this._cache      = new Map();
	}

	async findBySlug(slug) {
		if (this._cache.has(slug)) return this._cache.get(slug);
		const entry = await this._store.findEntry(e => e.system?.slug === slug);
		if (entry) {
			const doc      = await this._store.getDocument(entry._id);
			const follower = new Follower({ name: doc.name, img: doc.img, ...doc.system });
			this._cache.set(slug, follower);
			return follower;
		}
		const worldEntry = await this._worldStore.findEntry(e => e.system?.slug === slug);
		if (!worldEntry) return null;
		const follower = new Follower({ name: worldEntry.name, img: worldEntry.img, ...worldEntry.system });
		this._cache.set(slug, follower);
		return follower;
	}

	async findBySlugs(slugs) {
		return (await Promise.all(slugs.map(s => this.findBySlug(s)))).filter(Boolean);
	}

	// { slug, name }[] of every referenceable follower (compendium + world), for authoring pickers.
	async listSummaries() {
		return summarizeEntries([...(await this._store.getAll()), ...(await this._worldStore.getAll())]);
	}
}
