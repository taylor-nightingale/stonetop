import { FoundryPackStore } from "./FoundryPackStore.js";
import { WorldItemStore } from "./WorldItemStore.js";
import { summarizeEntries } from "./referenceSummaries.js";

export class FoundryInsertRepository {
	constructor() {
		this._store      = new FoundryPackStore("stonetop.inserts", ["system.slug"]);
		this._worldStore = new WorldItemStore("insert");
		this._cache      = new Map();
	}

	async findBySlug(slug) {
		if (this._cache.has(slug)) return this._cache.get(slug);
		const entry = await this._store.findEntry(e => e.system?.slug === slug);
		if (!entry) return null;
		const doc = await this._store.getDocument(entry._id);
		if (!doc) return null;
		this._cache.set(slug, doc);
		return doc;
	}

	// { slug, name }[] of every referenceable insert (compendium + world), for authoring pickers.
	async listSummaries() {
		return summarizeEntries([...(await this._store.getAll()), ...(await this._worldStore.getAll())]);
	}
}
