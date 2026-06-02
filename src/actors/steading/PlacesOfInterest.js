export class PlacesOfInterest {
	constructor(actor) {
		this._actor = actor;
	}

	get _places() {
		return this._actor.system.placesOfInterest ?? [];
	}

	async addBlankPlace() {
		await this._actor.update({"system.placesOfInterest": [...this._places, ""]});
	}

	async setPlaceValue(index, value) {
		const places  = [...this._places];
		places[index] = value;
		await this._actor.update({"system.placesOfInterest": places});
	}

	buildSnapshot() {
		return this._places.map((value, i) => ({
			key:   String.fromCharCode(65 + i),
			value,
			index: i,
		}));
	}
}
