import { hasArtFile } from "../../../art/foundryArt.js";

// Which installer-provided illustrations this world actually has. The art store is populated by the
// in-Foundry installer from the user's own books, so a path that exists in one world is missing in
// another — and linking a missing one 404s on every render.
//
// A repository rather than a flag threaded down from the sheet: "is this asset present" is an
// environment question, and this is the seam that answers it.
export class FoundrySteadingArtRepository {
	static SEASONS_PLATE = "stonetop-art/steading/seasons.png";

	/** The Seasons Change harvest plate's path, or null when this world hasn't installed it. */
	async seasonsPlate() {
		const path = FoundrySteadingArtRepository.SEASONS_PLATE;
		return (await hasArtFile(path)) ? path : null;
	}
}
