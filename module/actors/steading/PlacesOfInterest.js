import {StonetopFlags} from "../character/StonetopFlags.js";
import {SteadingDefaults} from "../../model/data/steading/SteadingDefaults.js";

export class PlacesOfInterest {
	constructor(actor) {
		this._actor = actor;
		this._flags = new StonetopFlags(this._actor, "placesOfInterest");
	}

	get _placesOfInterest() {
		return this._flags.getFlag("places") ?? [];
	}

	async _setPlacesOfInterest(poi) {
		await this._flags.setFlag("places", poi);
	}

	get defaultsAdded() {
		return this._flags.getFlag("defaultsAdded") ?? false;
	}

	async setDefaultsAdded(defaultsAdded) {
		await this._flags.setFlag("defaultsAdded", defaultsAdded);
	}

	async buildSnapshot() {
		if (!this.defaultsAdded) {
			const poi = [...SteadingDefaults.placesOfInterest, ...this._placesOfInterest];
			await this._setPlacesOfInterest(poi)
			await this.setDefaultsAdded(true);
		}

		const poi = this._placesOfInterest;
		const snapshot = [];
		for (let i = 0; i < this._placesOfInterest.length; i++) {
			snapshot.push({key: this.letterOfAlphabet(i), value: poi[i], index: i});
		}
		return snapshot;
	}

	async addBlankPlace() {
		let placesOfInterest = this._placesOfInterest;
		placesOfInterest.push("");
		await this._setPlacesOfInterest(placesOfInterest);
	}

	async setPlaceValue(index, value) {
		let placesOfInterest = this._placesOfInterest;
		placesOfInterest[index] = value;
		await this._setPlacesOfInterest(placesOfInterest);
	}


	letterOfAlphabet(i) {
		return String.fromCharCode(65 + i);
	}
}
