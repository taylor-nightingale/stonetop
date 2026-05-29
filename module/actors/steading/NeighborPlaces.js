import {StonetopFlags} from "../character/StonetopFlags.js";
import {SteadingDefaults} from "../../model/data/steading/SteadingDefaults.js";

function _uid() {
	return Math.random().toString(36).slice(2, 10);
}

export class NeighborPlaces {
	constructor(actor) {
		this._flags = new StonetopFlags(actor, "steading");
	}

	get _list() {
		return this._flags.getFlag("neighborPlaces") ?? [];
	}

	get _defaultsAdded() {
		return this._flags.getFlag("neighborPlacesDefaultsAdded") ?? false;
	}

	async _save(list) {
		await this._flags.setFlag("neighborPlaces", list);
	}

	async updateNote(id, note) {
		await this._save(this._list.map(p => p.id === id ? {...p, note} : p));
	}

	async updateNames(id, names) {
		await this._save(this._list.map(p => p.id === id ? {...p, names} : p));
	}

	async buildSnapshot() {
		if (!this._defaultsAdded) {
			await this._save(SteadingDefaults.neighborPlaces.map(p => ({id: _uid(), ...p})));
			await this._flags.setFlag("neighborPlacesDefaultsAdded", true);
		}
		return this._list;
	}
}
