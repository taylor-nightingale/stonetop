import { Arcanum } from "../../../model/data/character/Arcanum.js";
import { FoundryPackStore } from "./FoundryPackStore.js";

export class FoundryArcanaRepository {
	constructor() {
		this._store = new FoundryPackStore("stonetop.arcana", ["system.slug"]);
		this._cache = new Map();
	}

	async findBySlug(slug) {
		if (this._cache.has(slug)) return this._cache.get(slug);
		const entry = await this._store.findEntry(e => e.system?.slug === slug);
		if (!entry) return null;
		const doc    = await this._store.getDocument(entry._id);
		const arcanum = new Arcanum({ ...doc.system, name: doc.name, img: doc.img });
		this._cache.set(slug, arcanum);
		return arcanum;
	}

	async findBySlugs(slugs) {
		return (await Promise.all(slugs.map(s => this.findBySlug(s)))).filter(Boolean);
	}
}
