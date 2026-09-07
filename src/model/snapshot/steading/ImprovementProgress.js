/**
 * One improvement on the Season tab's project board: how far along it is, and how close to done.
 *
 * Progress is measured against the improvement's own REQUIREMENT, not against its boxes. The book
 * often offers more ways than it asks for — Greater Harvest prints two and wants one — so counting
 * boxes made it permanently 1 of 2 and it could never complete. The requirement knows the cheapest
 * way to satisfy it, and that is the denominator a table is actually working toward.
 */
import { EffectChip } from "./EffectChip.js";
import { Moments } from "../../data/steading/Moments.js";

export class ImprovementProgress {
	constructor({ slug, name, group, ticked, total, meter, isMet, chips = [], payoff = null,
	              firesThisSeason = false }) {
		this.slug       = slug;
		this.name       = name;
		// The improvement's own choice group, carried so the board card can open onto the REAL
		// requirement rows (improvement-group.hbs, the shared choice wiring) rather than a read-only
		// copy of them — the board summarises the ticking, it does not replace it.
		this.group      = group;
		this.ticked     = ticked;
		this.total      = total;
		// One pip per box the requirement actually asks for, so a reader sees how far off they are
		// rather than a denominator the book never named.
		this.meter      = meter;
		this._isMet     = isMet;
		// What the improvement is FOR, as the numbers its results already state. Shut, a card is a
		// name and a meter — how far along, and nothing about what the work buys. See EffectChip.
		this.chips      = chips;
		// Everything the improvement gives you, in the book's two halves — what finishing it does, and
		// what holds henceforth. Always present, earned or not: this is the only place the payoff is
		// stated now.
		this.payoff = payoff;
		// Whether anything this improvement does fires in the season the steading is IN — its turn
		// results, or a moment that can occur now. A board of twenty rows says nothing about which of
		// them the table is about to need.
		this.firesThisSeason = firesThisSeason;
	}

	/**
	 * Whether this card is owed something the sheet can write.
	 *
	 * Only when there is something to DO. An improvement whose completion is all fiction — Township
	 * changing Size, Roadbuilding letting you build roads — has nothing to press, and a card claiming
	 * otherwise would be asking for a click that does nothing.
	 */
	get isOwed() { return Boolean(this.payoff?.isOwed); }

	/** One box short. Worth knowing on a board where the next tick finishes something. */
	get isNearlyDone() { return !this.isComplete && this.total > 0 && this.total - this.ticked === 1; }

	/**
	 * Why this card wants the reader's attention, as a localize key — or null when it does not.
	 *
	 * ONE reason, the strongest: a card that is owed something is owed something whether or not it
	 * also fires this season, and three badges on one row would be a wall of its own. Stated as a
	 * word rather than a colour or a dot, because a marker whose meaning has to be learned is not a
	 * marker.
	 *
	 * Nothing here re-orders the board. The card that becomes owed is the card someone just ticked
	 * the last box of, and a board that promoted it would move it out from under them at exactly that
	 * moment — so the row stays where it is and says what it needs instead.
	 */
	get attentionKey() {
		if (this.isOwed)          return "stonetop.steading.improvements.owed";
		if (this.firesThisSeason) return "stonetop.steading.improvements.firesNow";
		if (this.isNearlyDone)    return "stonetop.steading.improvements.nearlyDone";
		return null;
	}

	get needsAttention() { return this.attentionKey !== null; }

	/** Which chip this row answers to, and what the board filters on. */
	get state() {
		return this.isComplete ? "complete" : this.isInProgress ? "progress" : "untouched";
	}

	/** Asked of the requirement expression, which is the only thing that knows what "done" means. */
	get isComplete() { return this._isMet; }

	/** Nothing ticked yet — on the board, but not yet a project. */
	get isUntouched() { return this.ticked === 0; }

	get isInProgress() { return !this.isComplete && !this.isUntouched; }

	/** How far along, 0–1. An improvement that requires nothing counts as done. */
	get fraction() { return this.total > 0 ? this.ticked / this.total : 1; }

	/**
	 * @param improvement  the SteadingImprovement, which owns the requirement expression
	 * @param group        its built ChoiceGroup, for the card to open onto
	 * @param storedValues this steading's ticks for that improvement
	 */
	static from(improvement, group, storedValues = {}, payoff = null, season = null) {
		const boxes  = improvement.boxesFrom(storedValues);
		const req    = improvement.requires;
		const total  = req.neededIn(boxes);
		const ticked = Math.min(req.tickedIn(boxes), total);

		return new ImprovementProgress({
			slug:   improvement.slug,
			name:   improvement.name,
			group,
			ticked,
			total,
			// Built from the count rather than from the rows: with "1 of these two" the requirement
			// asks for one box, and drawing two would show a denominator the book never named.
			meter:  Array.from({ length: total }, (_, i) => i < ticked),
			isMet:  req.isMet(boxes),
			chips:  EffectChip.forImprovement(improvement, storedValues),
			payoff,
			firesThisSeason: ImprovementProgress._firesIn(improvement, boxes, season),
		});
	}

	/**
	 * Whether anything this improvement does fires in the given season.
	 *
	 * Both cadences a season carries: what fires when the wheel arrives, and what fires at a moment
	 * the season can hold. `firingAt` answers the requirement half too, so an unbuilt mill is not
	 * "firing this autumn" merely because a built one would.
	 */
	static _firesIn(improvement, boxes, season) {
		if (!season) return false;
		if (improvement.effects.firingAt("turn", boxes, { season }).length) return true;
		return Moments.inSeason(season)
			.some(moment => improvement.effects.firingAt("moment", boxes, { moment: moment.key }).length);
	}
}

/**
 * The board itself: its rows, and the counts its chips state.
 *
 * The counts are asked of the board rather than counted in the template — "how many are in progress"
 * is a fact about the board, and a Handlebars filter would put that fact in markup where nothing
 * tests it.
 *
 * The rows keep the order the steading owns its improvements in. The board used to sort by how close
 * each was to done, which meant ticking a requirement moved the card you were ticking — the one
 * ordering guaranteed to reshuffle itself exactly when someone is working in it.
 */
export class ImprovementBoard {
	constructor(entries = []) {
		this.entries = [...entries];
	}

	get isEmpty()        { return this.entries.length === 0; }
	get inProgressCount(){ return this.entries.filter(e => e.isInProgress).length; }
	get untouchedCount() { return this.entries.filter(e => e.isUntouched).length; }
	get completeCount()  { return this.entries.filter(e => e.isComplete).length; }

	// The two questions a board of twenty rows cannot answer by being read: what is finished and
	// unclaimed, and what matters right now. Both cut ACROSS the three states — an owed card is also
	// a complete one — so they narrow on their own axis rather than joining the state chips.
	get owedCount()      { return this.entries.filter(e => e.isOwed).length; }
	get thisSeasonCount(){ return this.entries.filter(e => e.firesThisSeason).length; }
}
