import {StonetopFlags} from "../character/StonetopFlags.js";
import {SteadingDefaults} from "../../model/data/steading/SteadingDefaults.js";

export class SteadingAssets {
	constructor(actor) {
		this._flags = new StonetopFlags(actor, "steading");
	}

	get _state() {
		return this._flags.getFlag("assets") ?? {};
	}

	async addItem() {
		const state = this._state;
		const items = [...(state.items ?? SteadingDefaults.assets.items), ""];
		await this._flags.setFlag("assets", {...state, items});
	}

	async removeItem(index) {
		const state = this._state;
		const items = [...(state.items ?? SteadingDefaults.assets.items)];
		items.splice(index, 1);
		await this._flags.setFlag("assets", {...state, items});
	}

	async updateItem(index, value) {
		const state = this._state;
		const items = [...(state.items ?? SteadingDefaults.assets.items)];
		items[index] = value;
		await this._flags.setFlag("assets", {...state, items});
	}

	async updateCoinageEntry(index, field, value) {
		const state = this._state;
		const coinage = [...(state.coinage ?? SteadingDefaults.assets.coinage)];
		coinage[index] = {...coinage[index], [field]: value};
		await this._flags.setFlag("assets", {...state, coinage});
	}

	buildSnapshot() {
		const state = this._state;
		return {
			items:   state.items   ?? SteadingDefaults.assets.items,
			coinage: state.coinage ?? SteadingDefaults.assets.coinage,
		};
	}
}
