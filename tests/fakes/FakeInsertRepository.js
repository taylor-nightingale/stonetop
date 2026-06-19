export class FakeInsertRepository {
	constructor(inserts = []) {
		this._inserts = inserts;
	}

	async findBySlug(slug) {
		return this._inserts.find(i => i.system?.slug === slug) ?? null;
	}
}
