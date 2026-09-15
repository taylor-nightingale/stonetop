import { hasArtFile, artFileUrl } from "../../../art/foundryArt.js";

// Which installer-provided illustrations this world actually has. The art store is populated by the
// in-Foundry installer from the user's own books, so a path that exists in one world is missing in
// another — and linking a missing one 404s on every render.
//
// A repository rather than a flag threaded down from the sheet: "is this asset present" is an
// environment question, and this is the seam that answers it.
export class FoundrySteadingArtRepository {
	static SEASONS_PLATE = "stonetop-art/steading/seasons.png";
	// The three whisky jugs from the village entry's Whisky section (Book of the Wider World,
	// p.12-21), which the art installer stores under its own content hash. Written out in full rather
	// than assembled: the shipped manifest is scanned out of the source, so a path built at runtime is
	// a path the installer never learns to recognize.
	static RESOURCES_PLATE = "stonetop-art/wonders/35054ea8d15b39521589bc2cab68c9f309301fe645948ac9fd0ed37d920da6c7.png";
	static RESIDENTS_PLATE = "stonetop-art/steading/residents.png";

	/** The Seasons Change harvest plate's url, or null when this world hasn't installed it. */
	async seasonsPlate() {
		return this.#installed(FoundrySteadingArtRepository.SEASONS_PLATE);
	}

	/** The url of the plate under the Resources list, or null when this world hasn't installed it. */
	async resourcesPlate() {
		return this.#installed(FoundrySteadingArtRepository.RESOURCES_PLATE);
	}

	/** The url of the plate closing the Folk roster, or null when this world hasn't installed it. */
	async residentsPlate() {
		return this.#installed(FoundrySteadingArtRepository.RESIDENTS_PLATE);
	}

	// The ROUTED url, not the stored path. Each plate is drawn by an `<img>`, which would resolve
	// the relative path itself — but the seasons plate is also handed to `shape-outside`, and a
	// relative url() in CSS resolves against the stylesheet rather than the document. See artFileUrl.
	async #installed(path) {
		return (await hasArtFile(path)) ? artFileUrl(path) : null;
	}
}
