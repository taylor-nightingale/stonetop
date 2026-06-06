import { FoundryPackStore } from "./FoundryPackStore.js";

export class FoundryInsertRepository {
	constructor() {
		this._store = new FoundryPackStore("stonetop.inserts", ["system.slug"]);
		this._cache = new Map();
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
}
