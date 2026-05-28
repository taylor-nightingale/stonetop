import {StonetopFlags} from "../character/StonetopFlags.js";
import {SteadingDefaults} from "../../model/data/steading/SteadingDefaults.js";

export class SteadingAssets {
	constructor(actor) {
		this._flags = new StonetopFlags(actor, "steading");
	}

	get _state() {
		return this._flags.getFlag("assets") ?? {};
	}

	async updateCoinageEntry(index, field, value) {
		const state = this._state;
		const coinage = [...(state.coinage ?? SteadingDefaults.assets.coinage)];
		coinage[index] = {...coinage[index], [field]: value};
		await this._flags.setFlag("assets", {...state, coinage});
	}

	buildSnapshot() {
		const state = this._state;
		return {coinage: state.coinage ?? SteadingDefaults.assets.coinage};
	}
}
