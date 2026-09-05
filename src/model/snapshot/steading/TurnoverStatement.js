import { rich } from "../RichText.js";
import { EffectChip } from "./EffectChip.js";

/**
 * What a set of improvement results proposes to do to the steading, before anyone commits.
 *
 * The turnover CHANGES the steading, and six people share this document — so it is never a series of
 * silent edits accumulating as somebody scrolls. It is one statement, reviewed, with any line opted
 * out of, applied once.
 *
 * The same shape serves both places results fire: an improvement's completion, and the turn of the
 * season. Both ask "here is what this does — apply it?".
 */

/** One result, in the context of the thing that caused it. */
export class TurnoverLine {
	constructor({ id, source, effect, included = true }) {
		this.id       = id;
		this.source   = source;      // the improvement's name
		this.effect   = effect;      // ImprovementEffect
		this.included = included;
		this.text     = rich(effect.text);
	}

	/** Arithmetic the sheet can do. Advisory lines carry no checkbox and are never counted. */
	get isAutomatic() { return this.effect.isAutomatic; }

	get condition()  { return this.effect.condition; }
	get grantsMove() { return this.effect.grantsMove; }

	/** Whether this line will actually be applied — automatic, and not opted out of. */
	get willApply() { return this.isAutomatic && this.included; }

	/**
	 * "+1 Surplus" — the chip beside the line, as an EffectChip so the rating is named through the
	 * same key the board's chips and the statement's totals use. It was written out here once, which
	 * printed the raw `surplus` in every language.
	 *
	 * No timing on it: on the season's own panel the timing is the panel.
	 */
	get delta() {
		return this.effect.change ? EffectChip.forChange(this.effect.change) : null;
	}

	/** What it writes onto an evidence list, if anything. */
	get listEntry() { return this.effect.listEntry; }

	static idFor(improvementSlug, index) { return `${improvementSlug}:${index}`; }
}

/** One rating's before → after, for the statement's footer. */
export class RatingTotal {
	constructor(target, from, delta) {
		this.target = target;
		this.from   = from;
		this.delta  = delta;
		this.to     = from + delta;
	}

	get label() { return `${this.delta < 0 ? "−" : "+"}${Math.abs(this.delta)}`; }
}

export class TurnoverStatement {
	/**
	 * @param lines   TurnoverLine[]
	 * @param ratings the steading's current values, keyed by target
	 */
	constructor(lines = [], ratings = {}) {
		this.lines    = lines;
		this._ratings = ratings;
	}

	get isEmpty()  { return this.lines.length === 0; }

	/** Lines the table can include or leave out — the ones with a checkbox. */
	get automatic() { return this.lines.filter(l => l.isAutomatic); }

	/** Stated with their source and left to the table: rolled, conditional, adjusting, or fiction. */
	get advisory()  { return this.lines.filter(l => !l.isAutomatic); }

	get hasAutomatic() { return this.automatic.length > 0; }

	/** Whether anything would actually change if Apply were pressed now. */
	get willChangeAnything() { return this.lines.some(l => l.willApply); }

	/**
	 * The net effect on each rating, in the order the ratings are named — before and after, so the
	 * table sees the consequence rather than a list of deltas to add up themselves.
	 *
	 * Only INCLUDED automatic lines count. An opted-out line contributes nothing, and an advisory one
	 * never did.
	 */
	get totals() {
		const deltas = new Map();
		for (const line of this.lines) {
			if (!line.willApply || !line.effect.change) continue;
			const { target, amount } = line.effect.change;
			deltas.set(target, (deltas.get(target) ?? 0) + amount);
		}
		return [...deltas]
			.filter(([, delta]) => delta !== 0)
			.map(([target, delta]) => new RatingTotal(target, this._ratings[target] ?? 0, delta));
	}

	/**
	 * The moves these results CONFER, by slug and without repeats.
	 *
	 * Kept apart from the lines because it is the one thing the book's own prose cannot supply. The
	 * clause already reads "when you lead the aurochs hunt in spring, roll +Defenses" — what it cannot
	 * do is roll it, so the sheet offers that and nothing else. Never an applied line: what a move
	 * does depends on what it rolls.
	 */
	get grantedMoveSlugs() {
		return [...new Set(this.lines.map(l => l.grantsMove).filter(Boolean))];
	}

	/** The evidence-list entries included lines would add. */
	get listEntries() {
		return this.lines.filter(l => l.willApply && l.listEntry).map(l => l.listEntry);
	}
}
