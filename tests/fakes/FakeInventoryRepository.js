export class FakeInventoryRepository {
	constructor(items) {
		this._items = items ?? [];
	}
	async getAll() {
		return this._items;
	}
}
