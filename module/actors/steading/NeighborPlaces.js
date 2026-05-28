import {StonetopFlags} from "../character/StonetopFlags.js";

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

	async _save(list) {
		await this._flags.setFlag("neighborPlaces", list);
	}

	async addPlace() {
		await this._save([...this._list, {id: _uid(), name: "", note: "", names: []}]);
	}

	async removePlace(id) {
		await this._save(this._list.filter(p => p.id !== id));
	}

	async updatePlace(id, field, value) {
		await this._save(this._list.map(p => p.id === id ? {...p, [field]: value} : p));
	}

	async addName(placeId) {
		await this._save(this._list.map(p => p.id === placeId ? {...p, names: [...(p.names ?? []), ""]} : p));
	}

	async removeName(placeId, nameIndex) {
		await this._save(this._list.map(p => {
			if (p.id !== placeId) return p;
			const names = [...(p.names ?? [])];
			names.splice(nameIndex, 1);
			return {...p, names};
		}));
	}

	async updateName(placeId, nameIndex, value) {
		await this._save(this._list.map(p => {
			if (p.id !== placeId) return p;
			const names = [...(p.names ?? [])];
			names[nameIndex] = value;
			return {...p, names};
		}));
	}

	buildSnapshot() {
		return this._list.map(p => ({...p, names: p.names ?? []}));
	}
}
