export class FakeWorldItemStore {
	_items = [];

	add(item) { this._items.push(item); return this; }

	async findEntry(pred)     { return this._items.find(pred) ?? null; }
	async filterEntries(pred) { return this._items.filter(pred); }
	async getAll()            { return [...this._items]; }
	async getDocument(id)     { return this._items.find(i => i._id === id) ?? null; }
}
