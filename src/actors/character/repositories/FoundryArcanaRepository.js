import { Arcanum } from "../../../model/data/character/Arcanum.js";
import { FoundryPackStore } from "./FoundryPackStore.js";
import { WorldItemStore } from "./WorldItemStore.js";

export class FoundryArcanaRepository {
	constructor() {
		this._store      = new FoundryPackStore("stonetop.arcana", ["system.slug"]);
		this._worldStore = new WorldItemStore("equipment", i => i.system?.equipmentType === "arcanum");
		this._cache      = new Map();
	}

	async findBySlug(slug) {
		if (this._cache.has(slug)) return this._cache.get(slug);
		const entry = await this._store.findEntry(e => e.system?.slug === slug);
		if (entry) {
			const doc     = await this._store.getDocument(entry._id);
			const arcanum = new Arcanum({ ...doc.system, name: doc.name, img: doc.img });
			this._cache.set(slug, arcanum);
			return arcanum;
		}
		const worldEntry = await this._worldStore.findEntry(e => e.system?.slug === slug);
		if (!worldEntry) return null;
		const arcanum = new Arcanum({ ...worldEntry.system, name: worldEntry.name, img: worldEntry.img });
		this._cache.set(slug, arcanum);
		return arcanum;
	}

	async findBySlugs(slugs) {
		return (await Promise.all(slugs.map(s => this.findBySlug(s)))).filter(Boolean);
	}
}
