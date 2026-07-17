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
import {applySteadfast, loadSteadfast, matchSteadfastByName} from "./applySteadfast.js";

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

	/** Prosperity as character sheets display it: the steading's name, the roll bonus,
	 *  and whether the "lacking" debility applies (treat Prosperity as 1 lower). */
	getProsperity() {
		return {
			steadingName: this._actor.name,
			value:        this.resolveBonus("prosperity") ?? 0,
			lacking:      this._actor.system.debilities?.lacking === true,
		};
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


	// Pre-create, before the document persists (updateSource-only territory). Steadings have no
	// pre-create defaults; the hook dispatches here uniformly.
	onPreCreate(_data) {}

	// Post-create initialization, once, on the creating client (CreateActor hook → typedActor
	// dispatch; async pack loads can't run preCreate). A brand-new steading adopts the Stonetop
	// steadfast so it opens with out-of-the-box values — one that already has a steadfast
	// (duplicated, imported, created from a template) is left alone. Then the homefront reference
	// moves seed as owned items — idempotent, so a duplicated actor isn't re-seeded; after this
	// they're ordinary items the GM can edit, delete, or re-add via drag-drop.
	async onCreate() {
		if (!this._actor.system?.steadfast) {
			const steadfast = await loadSteadfast("stonetop");
			if (steadfast) await applySteadfast(this._actor, steadfast);
		}
		await this.moves.seedHomefrontMoves();
	}

	// Routing for an item dropped on the steading. A steadfast re-seeds the definition (never
	// embeds); a move joins the homefront list through SteadingMoves, which stamps the category
	// fields an embedded steading move requires. Returns true when handled — false tells the caller
	// (the sheet) to fall back to the default embed.
	async applyDroppedItem(item) {
		if (item?.type === "steadfast") {
			await applySteadfast(this._actor, item);
			return true;
		}
		if (item?.type === "move") {
			await this.moves.addMove(item);
			return true;
		}
		return false;
	}

	// The name combobox doubles as the steadfast picker: a value matching a known steadfast name
	// applies that steadfast (re-seeds the definition fields and adopts its name; runtime state like
	// residents/debilities is preserved). Any other value is just the steading's own name.
	// `availableSteadfasts` is the {slug, name} list from loadAllSteadfasts.
	async renameOrApplySteadfast(value, availableSteadfasts = []) {
		const name = (value ?? "").trim();
		const match = matchSteadfastByName(name, availableSteadfasts);
		if (match) {
			const steadfast = await loadSteadfast(match.slug);
			if (steadfast) await applySteadfast(this._actor, steadfast);
		} else if (name && name !== this._actor.name) {
			await this._actor.update({ name });
		}
	}

	async buildSnapshot() {
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
