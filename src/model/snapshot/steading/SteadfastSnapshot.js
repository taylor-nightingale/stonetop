import { splitIntoColumns } from "./SteadingSnapshot.js";

// The render data for the steadfast item sheet — the same profile sections a steading shows (built by
// the shared SteadingAttributes / SteadingAssets / PlacesOfInterest / NeighborPlaces controllers +
// partials), minus the steading-only, in-play concerns (debilities, moves, notes/content, the live
// resident/neighbor people rosters, roll mode). A steadfast is a template: Fortunes/Surplus are plain
// starting counts and its granted improvements render as a read-only resolved list (no track state).
export class SteadfastSnapshot {
	constructor({
		name, img,
		attributes, fortunes, surplus, assets,
		placesOfInterest, neighborPlaces,
		residentNames, residentTraits, improvements,
	}) {
		this.name             = name;
		this.img              = img;
		this.attributes       = attributes;                       // {size, population, prosperity, defenses}
		this.fortunes         = fortunes;
		this.surplus          = surplus;
		this.assets           = assets;                           // {items, resources, fortifications, coinage}
		this.placesOfInterest = placesOfInterest;
		this.neighbors        = { places: neighborPlaces };
		this.residentNames    = residentNames;
		this.residentTraits   = residentTraits;
		this.residentTraitsText = (residentTraits ?? []).join("\n");
		this.npcTraitColumns  = splitIntoColumns(residentTraits ?? [], 5);
		this.improvements     = improvements;                     // resolved ChoiceGroups (read-only)
	}
}
