import { SteadingAttributes } from "../actors/steading/SteadingAttributes.js";
import { SteadingAssets } from "../actors/steading/SteadingAssets.js";
import { PlacesOfInterest } from "../actors/steading/PlacesOfInterest.js";
import { NeighborPlaces } from "../actors/steading/NeighborPlaces.js";
import { SteadingImprovements } from "../actors/steading/SteadingImprovements.js";
import { SteadfastSnapshot } from "../model/snapshot/steading/SteadfastSnapshot.js";
import { addImprovement, removeImprovement } from "./steadfastImprovements.js";

// The typed wrapper for a `steadfast` item — the definition of a place a steading begins from. It
// composes the SAME profile controllers a live steading uses (attributes, assets, places, neighbor
// places, improvement resolution), which only touch `.system`/`.update` and so operate on an item just
// as they do on an actor. A steadfast is a template, so it carries none of the in-play concerns
// (debilities, moves, notes/content, resident/neighbor people rosters, roll mode); its Fortunes/Surplus
// are plain starting counts and its granted improvements resolve to a read-only list.
export class StonetopSteadfast {
	constructor(item, improvementsRepo) {
		this._item            = item;
		this.attributes       = new SteadingAttributes(item);
		this.assets           = new SteadingAssets(item);
		this.placesOfInterest = new PlacesOfInterest(item);
		this.neighborPlaces   = new NeighborPlaces(item);
		this.improvements     = new SteadingImprovements(item, improvementsRepo);
	}

	get type() {
		return "steadfast";
	}

	// The resident name/trait pool (suggestions for generating residents) — the steadfast authors both.
	async setResidentNames(names) {
		await this._item.update({ "system.residents.names": names });
	}

	async setResidentTraits(traits) {
		await this._item.update({ "system.residents.traits": traits });
	}

	// The improvement slugs this place grants (drag an improvement item on to add; × to remove). Both
	// are idempotent and only write when the list actually changes.
	get grantedImprovements() {
		return this._item.system.improvements ?? [];
	}

	async grantImprovement(slug) {
		const next = addImprovement(this.grantedImprovements, slug);
		if (next.length !== this.grantedImprovements.length) await this._item.update({ "system.improvements": next });
	}

	async revokeImprovement(slug) {
		await this._item.update({ "system.improvements": removeImprovement(this.grantedImprovements, slug) });
	}

	async buildSnapshot() {
		const sys = this._item.system;
		return new SteadfastSnapshot({
			name:             this._item.name,
			img:              this._item.img,
			attributes:       this.attributes.buildSnapshot(),
			fortunes:         sys.attributes?.fortunes ?? 0,
			surplus:          sys.attributes?.surplus ?? 0,
			assets:           this.assets.buildSnapshot(),
			placesOfInterest: this.placesOfInterest.buildSnapshot(),
			neighborPlaces:   this.neighborPlaces.buildSnapshot(),
			residentNames:    sys.residents?.names ?? "",
			residentTraits:   sys.residents?.traits ?? [],
			improvements:     await this.improvements.buildSnapshot(),
		});
	}
}
