import {StonetopFlags} from "../character/StonetopFlags.js";
import {SteadingDefaults} from "../../model/data/steading/SteadingDefaults.js";
import {FortunesSnapshot, SurplusSnapshot, SteadingSnapshot} from "../../model/snapshot/steading/SteadingSnapshot.js";
import {PlacesOfInterest} from "./PlacesOfInterest.js";
import {SteadingAttributes} from "./SteadingAttributes.js";
import {SteadingDebilities} from "./SteadingDebilities.js";
import {Residents} from "./Residents.js";
import {NeighborPeople} from "./NeighborPeople.js";
import {NeighborPlaces} from "./NeighborPlaces.js";
import {SteadingContent} from "./SteadingContent.js";
import {SteadingAssets} from "./SteadingAssets.js";
import {SteadingImprovements} from "./SteadingImprovements.js";

export class StonetopSteading {
	constructor(actor, improvementsRepo) {
		this._flags           = new StonetopFlags(actor, "steading");
		this.placesOfInterest = new PlacesOfInterest(actor);
		this.attributes       = new SteadingAttributes(actor);
		this.debilities       = new SteadingDebilities(actor);
		this.residents        = new Residents(actor);
		this.neighborPeople   = new NeighborPeople(actor);
		this.neighborPlaces   = new NeighborPlaces(actor);
		this.content          = new SteadingContent(actor);
		this.assets           = new SteadingAssets(actor);
		this.improvements     = new SteadingImprovements(actor, improvementsRepo);
	}

	get type() {
		return "steading";
	}

	get fortunesCurrent() {
		return this._flags.getFlag("fortunes") ?? SteadingDefaults.fortunes.current;
	}

	get surplusCurrent() {
		return this._flags.getFlag("surplus") ?? SteadingDefaults.surplus.current;
	}

	get notes() {
		return this._flags.getFlag("notes") ?? "";
	}

	async setFortunes(index) {
		await this._flags.setFlag("fortunes", index);
	}

	async setSurplus(value) {
		await this._flags.setFlag("surplus", value);
	}

	async setNotes(value) {
		await this._flags.setFlag("notes", value);
	}

	async buildSnapshot() {
		return new SteadingSnapshot({
			fortunes: new FortunesSnapshot(
				SteadingDefaults.fortunes.title, SteadingDefaults.fortunes.note,
				this.fortunesCurrent, SteadingDefaults.fortunes.options,
			),
			surplus: new SurplusSnapshot(
				SteadingDefaults.surplus.title, SteadingDefaults.surplus.note, this.surplusCurrent,
			),
			attributes:         await this.attributes.buildSnapshot(),
			debilities:         this.debilities.buildSnapshot(),
			placesOfInterest:   await this.placesOfInterest.buildSnapshot(),
			notes:              this.notes,
			residents:          this.residents.buildSnapshot(),
			neighbors: {
				people: this.neighborPeople.buildSnapshot(),
				places: await this.neighborPlaces.buildSnapshot(),
			},
			contentDescription: SteadingDefaults.content.description,
			content:            this.content.buildSnapshot(),
			assets:             this.assets.buildSnapshot(),
			improvements:       await this.improvements.buildSnapshot(),
			residentNames:      SteadingDefaults.residentNames,
			residentTraits:     SteadingDefaults.residentTraits,
		});
	}
}
