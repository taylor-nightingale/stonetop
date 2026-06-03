// Provides the same interface as FoundryPackStore but reads from game.items
// (world-owned items) rather than a compendium pack. game.items access is
// in-memory, so no indexing or caching is needed.
export class WorldItemStore {
	constructor(type, filter = null) {
		this._type   = type;
		this._filter = filter;
	}

	_items() {
		const all   = game.items?.contents ?? [];
		const typed = all.filter(i => i.type === this._type);
		return (this._filter ? typed.filter(this._filter) : typed).map(i => i.toObject());
	}

	async findEntry(pred)     { return this._items().find(pred) ?? null; }
	async filterEntries(pred) { return this._items().filter(pred); }
	async getAll()            { return this._items(); }
	async getDocument(id)     { return game.items?.get(id) ?? null; }
}
