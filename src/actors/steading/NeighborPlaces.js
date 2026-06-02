export class NeighborPlaces {
	constructor(actor) {
		this._actor = actor;
	}

	get _list() {
		return this._actor.system.neighborPlaces ?? [];
	}

	async updateNote(slug, note) {
		await this._actor.update({"system.neighborPlaces": this._list.map(p => p.slug === slug ? {...p, note} : p)});
	}

	async updateNames(slug, names) {
		await this._actor.update({"system.neighborPlaces": this._list.map(p => p.slug === slug ? {...p, names} : p)});
	}

	buildSnapshot() {
		return this._list;
	}
}
