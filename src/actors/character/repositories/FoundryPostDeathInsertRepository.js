import { PostDeathInsert } from "../../../model/data/character/PostDeathInsert.js";
import { FoundryPackStore } from "./FoundryPackStore.js";

export class FoundryPostDeathInsertRepository {
	constructor() {
		this._store = new FoundryPackStore("stonetop.post-death-inserts", ["system.slug"]);
		this._cache = new Map();
	}

	async getAll() {
		const entries = await this._store.getAll();
		return entries.map(e => ({ slug: e.system?.slug ?? "", name: e.name ?? "" }));
	}

	async findBySlug(slug) {
		if (this._cache.has(slug)) return this._cache.get(slug);
		const entry = await this._store.findEntry(e => e.system?.slug === slug);
		if (!entry) return null;
		const doc  = await this._store.getDocument(entry._id);
		const data = new PostDeathInsert(doc);
		this._cache.set(slug, data);
		return data;
	}
}
