import { buildChoiceGroup } from "../../model/snapshot/character/buildChoiceGroup.js";
import { SeasonalPicks } from "../../model/data/steading/SeasonalPicks.js";
import { SeasonProcedure } from "../../model/data/steading/SeasonProcedure.js";
import { Seasons } from "../../model/data/steading/Seasons.js";
import { SeasonPick, SeasonsSnapshot } from "../../model/snapshot/steading/SteadingSnapshot.js";
import { buildSeasonSteps } from "../../model/snapshot/steading/SeasonStepSnapshot.js";

// The Seasons Change tab: the book's own spread (Book I, p.85) — the season's pick, the harvest
// plate, and the four seasonal moves. The glyphs the book bullets them with are each move's own icon
// (its item image), so they render through the shared move list like any other move.
//
// It owns its move category end to end: it knows the key (from Seasons, which IS that category) and
// asks SteadingMoves for it, so nothing above has to partition move categories on its behalf. The
// pick is an ordinary choice group persisted through SteadingChoices, so it is made and released by
// the same machinery as every other choice in the system.
export class SteadingSeasons {
	constructor(choices, moves, artRepo, season, stepRolls = null) {
		this._choices = choices;
		this._moves   = moves;
		this._art     = artRepo;
		// What this season's dice-rolling steps have already done to Surplus, so a step that has been
		// rolled says what it did and offers to give it back rather than offering the roll again.
		this._stepRolls = stepRolls;
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
			applied: this._stepRolls?.all() ?? {},
			// The tier this season's own move last came up, for the result row that says so.
			outcome: this._season.rolledOutcome,
			plate,
			turnover,
		});
	}

	/**
	 * One roll of the season the steading is IN, with everything that bends it — a step, or one of
	 * the result rows of the move's own roll.
	 *
	 * What the ROLL asks for. The control offers 2d6+Population in a township and 1d4 with Population
	 * counted one lower under additional housing, and the roll has to make the same dice — so both go
	 * through the same assembly rather than the control describing one roll and the handler making
	 * another. The button carries only its index for the same reason: everything else about the step
	 * is answered here, from the move and the improvements, and never read back off the DOM.
	 */
	async stepAt(address) {
		const season   = this._season.season;
		const category = await this._moves.categorySnapshot(Seasons.CATEGORY);
		return buildSeasonSteps({
			procedure: SeasonProcedure.from(category?.moves?.find(m => m.slug === season.moveSlug)),
			statement: await this._season.statement(),
			applied:   this._stepRolls?.all() ?? {},
			// The harvest's own 1d4 AND what the steading brings to it: the mill's +1 is inside the
			// roll now, so a step assembled without the moments would roll something smaller than the
			// control that offered it.
			moments:   await this._season.moments(),
			// Winter's dice follow the steading's Size, so a town's roll here is the 2d6 its control
			// offered rather than the village default the move's line names.
			size:      this._season.size,
		}).at(address);
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
