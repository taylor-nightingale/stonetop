import { Arcanum } from "../../src/model/data/character/Arcanum.js";
import { FakeWorldItemStore } from "./FakeWorldItemStore.js";

export class FakeArcanaRepository {
	_worldStore = new FakeWorldItemStore();

	constructor(arcana = []) { this._arcana = arcana; }

	addWorld(item) { this._worldStore.add(item); return this; }

	async findBySlug(slug) {
		const raw = this._arcana.find(a => a.slug === slug)
		         ?? await this._worldStore.findEntry(e => e.system?.slug === slug);
		return raw ? new Arcanum(raw) : null;
	}
	async findBySlugs(slugs) {
		return (await Promise.all(slugs.map(s => this.findBySlug(s)))).filter(Boolean);
	}

	add(arcanum) {
		this._arcana.push(arcanum);
	}
}
