import { FoundryPackStore } from "./FoundryPackStore.js";
import { WorldItemStore } from "./WorldItemStore.js";

export class FoundryArcanaRepository {
	constructor() {
		this._store      = new FoundryPackStore("stonetop.arcana", ["system.slug"]);
		this._worldStore = new WorldItemStore("arcanum");
		this._cache      = new Map();
	}

	async findBySlug(slug) {
		if (this._cache.has(slug)) return this._cache.get(slug);
		const entry = await this._store.findEntry(e => e.system?.slug === slug);
		if (entry) {
			const doc = await this._store.getDocument(entry._id);
			const raw = _toRaw(doc.system, doc.name, doc.img);
			this._cache.set(slug, raw);
			return raw;
		}
		const worldEntry = await this._worldStore.findEntry(e => e.system?.slug === slug);
		if (!worldEntry) return null;
		const raw = _toRaw(worldEntry.system, worldEntry.name, worldEntry.img);
		this._cache.set(slug, raw);
		return raw;
	}

	async findBySlugs(slugs) {
		return (await Promise.all(slugs.map(s => this.findBySlug(s)))).filter(Boolean);
	}
}

function _toRaw(system, name, img) {
	return {
		slug:  system.slug,
		major: system.major ?? false,
		name:  name ?? null,
		img:   img  ?? null,
		front: system.front ?? null,
		back:  system.back  ?? null,
	};
}
