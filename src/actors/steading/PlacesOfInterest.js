import {documentLink} from "../../model/snapshot/documentLink.js";

export class PlacesOfInterest {
	constructor(actor) {
		this._actor = actor;
	}

	get _places() {
		return this._actor.system.placesOfInterest ?? [];
	}

	async addBlankPlace() {
		await this._actor.update({"system.placesOfInterest": [...this._places, {name: "", linkUuid: ""}]});
	}

	async setPlaceValue(index, value) {
		const places  = [...this._places];
		places[index] = {...places[index], name: value};
		await this._actor.update({"system.placesOfInterest": places});
	}

	async linkDocument(index, uuid) {
		const places  = [...this._places];
		places[index] = {...places[index], linkUuid: uuid};
		await this._actor.update({"system.placesOfInterest": places});
	}

	async unlinkDocument(index) {
		const places  = [...this._places];
		places[index] = {...places[index], linkUuid: ""};
		await this._actor.update({"system.placesOfInterest": places});
	}

	buildSnapshot() {
		return this._places.map((place, i) => {
			const linkUuid = place.linkUuid ?? "";
			return {
				key:      String.fromCharCode(65 + i),
				value:    place.name,
				linkUuid,
				// A `@UUID` content link (any document type); null when unlinked.
				docLink:  documentLink(linkUuid),
				index:    i,
			};
		});
	}
}
