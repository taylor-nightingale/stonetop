export class FakeOutfitItems {
	_store = {};
	_deletedSources = [];

	async sync(source, items)    { this._store[source] = items; }
	async deleteBySource(source) { this._deletedSources.push(source); delete this._store[source]; }

	get deletedSources() { return this._deletedSources; }

	getItems(source)  { return this._store[source] ?? []; }
	getSlugs(source)  { return this.getItems(source).map(i => i.system.slug); }
	hasSource(source) { return source in this._store; }
}
