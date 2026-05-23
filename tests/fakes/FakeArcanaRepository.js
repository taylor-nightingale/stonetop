import {MinorArcanum} from "../../module/model/data/character/MinorArcanum.js";

export class FakeArcanaRepository {
	constructor(arcana = []) { this._arcana = arcana; }
	async findBySlug(slug) {
		const raw = this._arcana.find(a => a.slug === slug) ?? null;
		return raw ? new MinorArcanum(raw) : null;
	}
	async findBySlugs(slugs) {
		return (await Promise.all(slugs.map(s => this.findBySlug(s)))).filter(Boolean);
	}

	add(arcanum) {
		this._arcana.push(arcanum);
	}
}
