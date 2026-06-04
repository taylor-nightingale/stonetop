import { Possession } from "../../src/model/data/character/Possession.js";

export class FakePossessionRepository {
	constructor(possessions = []) {
		this._possessions = possessions.map(p => p instanceof Possession ? p : new Possession(p));
	}

	async findBySlug(slug) {
		return this._possessions.find(p => p.slug === slug) ?? null;
	}

	async findBySlugs(slugs) {
		return (await Promise.all(slugs.map(s => this.findBySlug(s)))).filter(Boolean);
	}
}
