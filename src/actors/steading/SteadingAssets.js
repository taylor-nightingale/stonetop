// The three asset lists a steading owns: general `items`, the `resources` backing Prosperity, and the
// `fortifications` backing Defenses (plus coinage). Resources/fortifications are edited through
// SteadingAttributes (they render under their rating); `items` is edited here. All share one keyed
// helper but are exposed via named methods — no field-string mutation leaks to callers.
export class SteadingAssets {
	constructor(actor) {
		this._actor = actor;
	}

	get _state() {
		return this._actor.system.assets;
	}

	async _saveList(list, values) {
		await this._actor.update({"system.assets": {...this._state, [list]: values}});
	}

	async addItem() {
		await this._saveList("items", [...this._state.items, ""]);
	}

	async removeItem(index) {
		const items = [...this._state.items];
		items.splice(index, 1);
		await this._saveList("items", items);
	}

	async updateItem(index, value) {
		const items = [...this._state.items];
		items[index] = value;
		await this._saveList("items", items);
	}

	async updateCoinageEntry(index, field, value) {
		const coinage = [...this._state.coinage];
		coinage[index] = {...coinage[index], [field]: value};
		await this._saveList("coinage", coinage);
	}

	buildSnapshot() {
		return {
			items:          this._state.items,
			resources:      this._state.resources,
			fortifications: this._state.fortifications,
			coinage:        this._state.coinage,
		};
	}
}
