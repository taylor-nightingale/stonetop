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
import {startingAttributeNote} from "./startingAttributeNote.js";

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
		return this._actor.getFlag("stonetop", "rollMode") ?? "normal";
	}

	async setRollMode(mode) {
		await this._actor.setFlag("stonetop", "rollMode", mode);
	}

	getRollableStats() {
		return [
			{ key: "population", name: "Population", value: this.resolveBonus("population") ?? 0 },
			{ key: "prosperity", name: "Prosperity", value: this.resolveBonus("prosperity") ?? 0 },
			{ key: "defenses",   name: "Defenses",   value: this.resolveBonus("defenses")   ?? 0 },
			{ key: "fortunes",   name: "Fortunes",   value: this.resolveBonus("fortunes")   ?? 0 },
		];
	}

	// Ratings are stored as their actual value now (fortunes +1, prosperity +0, …), so the roll bonus
	// is just the stored value. Surplus is a raw count in the same attributes block.
	resolveBonus(rollStat) {
		return this._actor.system.attributes?.[rollStat] ?? null;
	}

	applyRollMode(rollStat, rollMode) {
		return rollMode;
	}

	get fortunesCurrent() {
		return this._actor.system.attributes?.fortunes ?? 0;
	}

	get surplusCurrent() {
		return this._actor.system.attributes?.surplus ?? 0;
	}

	get notes() {
		return this._actor.system.notes ?? "";
	}

	async setFortunes(value) {
		await this._actor.update({"system.attributes.fortunes": value});
	}

	async setSurplus(value) {
		await this._actor.update({"system.attributes.surplus": value});
	}

	async setNotes(value) {
		await this._actor.update({"system.notes": value});
	}


	async buildSnapshot() {
		// Homefront moves seed onto the steading as embedded items (idempotent) the same way basic moves
		// seed onto a character — must run before the moves snapshot reads them back.
		await this.moves.seedHomefrontMoves();
		return new SteadingSnapshot({
			fortunes: new FortunesSnapshot(
				SteadingDefaults.fortunes.title, startingAttributeNote(this._actor, "fortunes"),
				this.fortunesCurrent, SteadingDefaults.fortunes.options, SteadingDefaults.fortunes.bonuses,
			),
			surplus: new SurplusSnapshot(
				SteadingDefaults.surplus.title, startingAttributeNote(this._actor, "surplus"), this.surplusCurrent,
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
			residentNames:      this._actor.system.residents?.names ?? "",
			residentTraits:     this._actor.system.residents?.traits ?? [],
			moves:              await this.moves.buildSnapshot(),
			rollMode:           this.rollMode,
		});
	}
}
