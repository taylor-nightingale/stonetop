import { buildChoiceGroup } from "../../model/snapshot/character/buildChoiceGroup.js";
import { SeasonalGains } from "../../model/data/steading/SeasonalGains.js";
import { Seasons } from "../../model/data/steading/Seasons.js";
import { SeasonsSnapshot } from "../../model/snapshot/steading/SteadingSnapshot.js";

// The Seasons Change tab: the book's own spread (Book I, p.85) — the Seasonal gains panel, the
// harvest plate, and the four seasonal moves. The glyphs the book bullets them with are each move's
// own icon (its item image), so they render through the shared move list like any other move.
//
// It owns its move category end to end: it knows the key (from Seasons, which IS that category) and
// asks SteadingMoves for it, so nothing above has to partition move categories on its behalf. The
// gains are an ordinary choice group persisted through SteadingChoices, so a pick is made and
// released by the same machinery as every other choice in the system.
export class SteadingSeasons {
	constructor(choices, moves, artRepo) {
		this._choices = choices;
		this._moves   = moves;
		this._art     = artRepo;
	}

	async buildSnapshot() {
		const [category, plate] = await Promise.all([
			this._moves.categorySnapshot(Seasons.CATEGORY),
			this._art.seasonsPlate(),
		]);
		return new SeasonsSnapshot({
			moves: category,
			gains: buildChoiceGroup(SeasonalGains.toChoiceGroupData(), this._choices.values),
			plate,
		});
	}


}
