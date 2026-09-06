/**
 * One improvement on the Season tab's project board: how far along it is, and how close to done.
 *
 * Progress is measured against the improvement's own REQUIREMENT, not against its boxes. The book
 * often offers more ways than it asks for — Greater Harvest prints two and wants one — so counting
 * boxes made it permanently 1 of 2 and it could never complete. The requirement knows the cheapest
 * way to satisfy it, and that is the denominator a table is actually working toward.
 */
import { EffectChip } from "./EffectChip.js";

export class ImprovementProgress {
	constructor({ slug, name, group, ticked, total, meter, isMet, chips = [], payoff = null }) {
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
	}

	/**
	 * Whether this card is owed something the sheet can write.
	 *
	 * Only when there is something to DO. An improvement whose completion is all fiction — Township
	 * changing Size, Roadbuilding letting you build roads — has nothing to press, and a card claiming
	 * otherwise would be asking for a click that does nothing.
	 */
	get isCompletionPending() { return Boolean(this.payoff?.isOwed); }

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
	static from(improvement, group, storedValues = {}, payoff = null) {
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
		});
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
}
