import { buildChoiceGroup } from "../../model/snapshot/character/buildChoiceGroup.js";
import { SeasonalPicks } from "../../model/data/steading/SeasonalPicks.js";
import { SeasonProcedure } from "../../model/data/steading/SeasonProcedure.js";
import { Seasons } from "../../model/data/steading/Seasons.js";
import { SeasonPick, SeasonsSnapshot } from "../../model/snapshot/steading/SteadingSnapshot.js";

// The Seasons Change tab: the book's own spread (Book I, p.85) — the season's pick, the harvest
// plate, and the four seasonal moves. The glyphs the book bullets them with are each move's own icon
// (its item image), so they render through the shared move list like any other move.
//
// It owns its move category end to end: it knows the key (from Seasons, which IS that category) and
// asks SteadingMoves for it, so nothing above has to partition move categories on its behalf. The
// pick is an ordinary choice group persisted through SteadingChoices, so it is made and released by
// the same machinery as every other choice in the system.
export class SteadingSeasons {
	constructor(choices, moves, artRepo, season) {
		this._choices = choices;
		this._moves   = moves;
		this._art     = artRepo;
		// Where the wheel stands and what fires when it turns. A separate collaborator because it is
		// a separate job — this class knows which four moves are seasonal, that one knows what season
		// it is — and the tab needs both in one snapshot.
		this._season  = season;
	}

	async buildSnapshot() {
		const [category, plate, turnover] = await Promise.all([
			this._moves.categorySnapshot(Seasons.CATEGORY),
			this._art.seasonsPlate(),
			this._season.buildSnapshot(),
		]);
		return new SeasonsSnapshot({
			moves: category,
			pick:  this._pickFor(category, turnover.season.moveSlug),
			plate,
			turnover,
		});
	}

	/**
	 * The choice the season the steading is IN hands the table.
	 *
	 * Off that season's own move, not a fixed list: the gains were hardcoded here at "pick 1", so
	 * summer offered one where its move gives two, and winter — which grants no gains at all and
	 * takes something instead — was handed the gains list.
	 */
	_pickFor(category, moveSlug) {
		const step = SeasonProcedure.from(category?.moves?.find(m => m.slug === moveSlug))?.pick;
		const list = step && SeasonalPicks.byKey(step.from);
		if (!list) return null;
		return new SeasonPick(step, buildChoiceGroup(list.toChoiceGroupData(step.count), this._choices.values));
	}
}
