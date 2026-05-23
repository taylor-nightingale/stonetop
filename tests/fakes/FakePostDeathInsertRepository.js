import { PostDeathInsert } from "../../module/model/data/character/PostDeathInsert.js";

export class FakePostDeathInsertRepository {
	constructor(inserts = []) {
		this._inserts = inserts;
	}

	async getAll() {
		return this._inserts.map(d => ({
			slug: d.system?.slug ?? d.slug ?? "",
			name: d.name ?? "",
		}));
	}

	async findBySlug(slug) {
		const doc = this._inserts.find(d => d.system?.slug === slug) ?? null;
		return doc ? new PostDeathInsert(doc) : null;
	}
}
