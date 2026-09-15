import { hasArtFile, artFileUrl } from "../../../art/foundryArt.js";

// Which installer-provided illustrations this world actually has. The art store is populated by the
// in-Foundry installer from the user's own books, so a path that exists in one world is missing in
// another — and linking a missing one 404s on every render.
//
// A repository rather than a flag threaded down from the sheet: "is this asset present" is an
// environment question, and this is the seam that answers it.
export class FoundrySteadingArtRepository {
	static SEASONS_PLATE = "stonetop-art/steading/seasons.png";

	/** The Seasons Change harvest plate's url, or null when this world hasn't installed it. */
	async seasonsPlate() {
		return this.#installed(FoundrySteadingArtRepository.SEASONS_PLATE);
	}

	// The ROUTED url, not the stored path. The plate is handed to CSS as well as to an `<img>`, and a
	// relative url() in a stylesheet resolves against the stylesheet rather than the document. See
	// artFileUrl.
	async #installed(path) {
		return (await hasArtFile(path)) ? artFileUrl(path) : null;
	}
}
