import { Possession } from "../../../model/data/character/Possession.js";
import { FoundryPackStore } from "./FoundryPackStore.js";
import { WorldItemStore } from "./WorldItemStore.js";
import { summarizeEntries } from "./referenceSummaries.js";

export class FoundryPossessionRepository {
	constructor() {
		this._store      = new FoundryPackStore("stonetop.possessions", ["system.slug"]);
		this._worldStore = new WorldItemStore("possession");
		this._cache      = new Map();
	}

	async findBySlug(slug) {
		if (this._cache.has(slug)) return this._cache.get(slug);
		const entry = await this._store.findEntry(e => e.system?.slug === slug);
		if (!entry) return null;
		const doc = await this._store.getDocument(entry._id);
		const possession = new Possession(doc.system, doc.name);
		this._cache.set(slug, possession);
		return possession;
	}

	async findBySlugs(slugs) {
		return (await Promise.all(slugs.map(s => this.findBySlug(s)))).filter(Boolean);
	}

	// { slug, name }[] of every referenceable possession (compendium + world), for authoring pickers.
	async listSummaries() {
		return summarizeEntries([...(await this._store.getAll()), ...(await this._worldStore.getAll())]);
	}
}
