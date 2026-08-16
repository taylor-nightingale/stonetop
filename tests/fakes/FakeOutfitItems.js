export class FakeOutfitItems {
	_store = {};
	_deletedSources = [];

	async sync(source, items)    { this._store[source] = items; }
	async deleteBySources(sources) {
		for (const source of sources) await this.deleteBySource(source);
	}

	async deleteBySource(source) { this._deletedSources.push(source); delete this._store[source]; }

	get deletedSources() { return this._deletedSources; }

	/** Slugs granted under any source, whichever source granted them. */
	get allSlugs() {
		return Object.values(this._store).flat().map(i => i.system.slug);
	}

	getItems(source)  { return this._store[source] ?? []; }
	getSlugs(source)  { return this.getItems(source).map(i => i.system.slug); }
	hasSource(source) { return source in this._store; }
}
