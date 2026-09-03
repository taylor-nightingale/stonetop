import { Coinage } from "./Coinage.js";
import { Currency } from "./Currency.js";
import { Asset } from "./Asset.js";
import { AssetsSnapshot } from "../../model/snapshot/steading/AssetsSnapshot.js";

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

	/** The general assets, as entities. Resources and fortifications stay plain strings — they back a
	 *  rating rather than being owned things that can leave town. */
	get _items() {
		return (this._state.items ?? []).map(Asset.fromRaw);
	}

	async _saveList(list, values) {
		await this._actor.update({"system.assets": {...this._state, [list]: values}});
	}

	async addItem() {
		await this._saveItems([...this._items, Asset.blank()]);
	}

	async removeItem(index) {
		await this._saveItems(this._items.filter((_, i) => i !== index));
	}

	async updateItem(index, value) {
		await this._replaceItem(index, asset => asset.withText(value));
	}

	/** At home, or out on an expedition. The one bit of state an asset carries. */
	async setRequisitioned(index, requisitioned) {
		await this._replaceItem(index, asset => asset.withRequisitioned(requisitioned));
	}

	async _replaceItem(index, change) {
		const items = this._items;
		if (!items[index]) return;
		await this._saveItems(items.map((asset, i) => i === index ? change(asset) : asset));
	}

	async _saveItems(items) {
		await this._saveList("items", items.map(asset => ({...asset})));
	}

	async updatePurses(title, count) {
		await this._updateCurrency(title, currency => currency.withPurses(count));
	}

	async updateHandfuls(title, count) {
		await this._updateCurrency(title, currency => currency.withHandfuls(count));
	}

	async updateCoins(title, count) {
		await this._updateCurrency(title, currency => currency.withCoins(count));
	}

	async _updateCurrency(title, change) {
		const current = Coinage.entries(this._state.coinage).find(c => c.title === title) ?? Currency.of(title);
		await this._saveList("coinage", Coinage.withUpdated(this._state.coinage, change(current)));
	}

	buildSnapshot() {
		return new AssetsSnapshot({
			items:          this._items,
			resources:      this._state.resources,
			fortifications: this._state.fortifications,
			coinage:        Coinage.entries(this._state.coinage),
		});
	}
}
