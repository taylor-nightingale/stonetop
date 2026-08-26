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

	// The real repository splits these: the sheet draws only what the Inventory insert prints (the
	// pack's "Default" folder), while the catalog behind it stays available to drag from. A fake with
	// no folders has nothing to split on, so everything it holds is the checklist — a test that cares
	// about the split builds the folders and uses the real repository.
	async getInsertItems() {
		return this.getAll();
	}
}
