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
import {SteadingMoves} from "./SteadingMoves.js";

export class StonetopSteading {
	constructor(actor, improvementsRepo, movesRepo) {
		this._actor          = actor;
		this.placesOfInterest = new PlacesOfInterest(actor);
		this.attributes       = new SteadingAttributes(actor);
		this.debilities       = new SteadingDebilities(actor);
		this.residents        = new Residents(actor);
		this.neighborPeople   = new NeighborPeople(actor);
		this.neighborPlaces   = new NeighborPlaces(actor);
		this.content          = new SteadingContent(actor);
		this.assets           = new SteadingAssets(actor);
		this.improvements     = new SteadingImprovements(actor, improvementsRepo);
		this.moves            = new SteadingMoves(actor, movesRepo);
	}

	get type() {
		return "steading";
	}

	get rollMode() {
		return this._actor.getFlag("stonetop", "rollMode") ?? "def";
	}

	async setRollMode(mode) {
		await this._actor.setFlag("stonetop", "rollMode", mode);
	}

	getRollableStats() {
		const attr = this._actor.system.attributes;
		return [
			{ key: "population", name: "Population", value: attr.population?.current ?? 0 },
			{ key: "prosperity", name: "Prosperity", value: attr.prosperity?.current ?? 0 },
			{ key: "defenses",   name: "Defenses",   value: attr.defenses?.current   ?? 0 },
			{ key: "fortunes",   name: "Fortunes",   value: this._actor.system.fortunes ?? 0 },
		];
	}

	resolveBonus(rollStat) {
		const sys  = this._actor.system;
		const attr = sys.attributes;
		if (rollStat === "fortunes")   return sys.fortunes                  ?? null;
		if (rollStat === "surplus")    return sys.surplus                   ?? null;
		if (rollStat === "population") return attr.population?.current ?? null;
		if (rollStat === "prosperity") return attr.prosperity?.current ?? null;
		if (rollStat === "defenses")   return attr.defenses?.current   ?? null;
		return null;
	}

	applyRollMode(rollStat, rollMode) {
		return rollMode;
	}

	get fortunesCurrent() {
		return this._actor.system.fortunes ?? SteadingDefaults.fortunes.current;
	}

	get surplusCurrent() {
		return this._actor.system.surplus ?? SteadingDefaults.surplus.current;
	}

	get notes() {
		return this._actor.system.notes ?? "";
	}

	async setFortunes(index) {
		await this._actor.update({"system.fortunes": index});
	}

	async setSurplus(value) {
		await this._actor.update({"system.surplus": value});
	}

	async setNotes(value) {
		await this._actor.update({"system.notes": value});
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
			attributes:         this.attributes.buildSnapshot(),
			debilities:         this.debilities.buildSnapshot(),
			placesOfInterest:   this.placesOfInterest.buildSnapshot(),
			notes:              this.notes,
			residents:          this.residents.buildSnapshot(),
			neighbors: {
				people: this.neighborPeople.buildSnapshot(),
				places: this.neighborPlaces.buildSnapshot(),
			},
			contentDescription: SteadingDefaults.content.description,
			content:            this.content.buildSnapshot(),
			assets:             this.assets.buildSnapshot(),
			improvements:       await this.improvements.buildSnapshot(),
			residentNames:      this._actor.system.residentNames,
			residentTraits:     this._actor.system.residentTraits,
			moves:              await this.moves.buildSnapshot(),
			rollMode:           this.rollMode,
		});
	}
}
