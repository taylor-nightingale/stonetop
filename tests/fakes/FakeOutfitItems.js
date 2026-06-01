export class FakeOutfitItems {
	_store = {};

	async sync(source, items)    { this._store[source] = items; }
	async deleteBySource(source) { delete this._store[source]; }

	getItems(source)  { return this._store[source] ?? []; }
	getSlugs(source)  { return this.getItems(source).map(i => i.system.slug); }
	hasSource(source) { return source in this._store; }
}
