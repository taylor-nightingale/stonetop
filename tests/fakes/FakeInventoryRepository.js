import { FakeWorldItemStore } from "./FakeWorldItemStore.js";

export class FakeInventoryRepository {
	_worldStore = new FakeWorldItemStore();

	constructor(items) {
		this._items = items ?? [];
	}

	addWorld(item) { this._worldStore.add(item); return this; }

	async getAll() {
		const world = await this._worldStore.getAll();
		return [...this._items, ...world];
	}
}
