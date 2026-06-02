export class SteadingAssets {
	constructor(actor) {
		this._actor = actor;
	}

	get _state() {
		return this._actor.system.assets;
	}

	async addItem() {
		await this._actor.update({"system.assets": {...this._state, items: [...this._state.items, ""]}});
	}

	async removeItem(index) {
		const items = [...this._state.items];
		items.splice(index, 1);
		await this._actor.update({"system.assets": {...this._state, items}});
	}

	async updateItem(index, value) {
		const items = [...this._state.items];
		items[index] = value;
		await this._actor.update({"system.assets": {...this._state, items}});
	}

	async updateCoinageEntry(index, field, value) {
		const coinage = [...this._state.coinage];
		coinage[index] = {...coinage[index], [field]: value};
		await this._actor.update({"system.assets": {...this._state, coinage}});
	}

	buildSnapshot() {
		return {
			items:   this._state.items,
			coinage: this._state.coinage,
		};
	}
}
