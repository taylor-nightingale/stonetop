import { rich } from "../RichText.js";
import { EffectChip } from "./EffectChip.js";

/**
 * What a set of improvement results proposes to do to the steading, before anyone commits.
 *
 * The turnover CHANGES the steading, and six people share this document — so it is never a series of
 * silent edits accumulating as somebody scrolls. Every result is listed with its source, and each one
 * the sheet can write carries its own control, so what was done is readable afterwards and any single
 * line can be taken back.
 *
 * The same shape serves both places results fire: an improvement's completion, and the turn of the
 * season. Both ask "here is what this does — apply it?".
 */

/** One result, in the context of the thing that caused it. */
export class TurnoverLine {
	constructor({ id, source, effect, earned = true, applied = null }) {
		this.id       = id;
		this.source   = source;      // the improvement's name
		this.effect   = effect;      // ImprovementEffect
		// Whether this result's requirement HOLDS yet. The season's own statement only ever collects
		// results that fire, so it is true there and always has been; an improvement's card states
		// what the improvement will do before it is built, and an unearned line is that promise —
		// shown, never applied. The prose that used to make the promise is no longer rendered.
		this.earned   = earned;
		// The AppliedEffect recording what this line wrote, or null while it is still owed. Per LINE,
		// not per statement: every applied line is independently revertable BECAUSE it was
		// independently applied.
		this.applied  = applied;
		this.text     = rich(effect.text);
		// The book's own trigger clause — "once per season, when you expend 1 Surplus and bring folks
		// together at the inn" — which opens the sentence `text` finishes. Carried on every line that
		// has one; WHETHER to print it is the surface's question (see the statement partial's
		// `showPhrase`), because a step, a tier or a panel that has already stated the trigger would
		// otherwise say it twice.
		//
		// An OWN property rather than a getter because enrichRichTextTree walks own enumerable keys —
		// a getter is invisible to it, and every @UUID and roll in the clause would render as source.
		this.phrase   = effect.trigger.phrase ? rich(effect.trigger.phrase) : null;
	}

	/** Arithmetic the sheet can do. Advisory lines carry no control and are never counted. */
	get isAutomatic() { return this.effect.isAutomatic; }

	/** Whether the clause is one the sheet cannot judge — stated, and never applied. */
	get isConditional() { return this.effect.isConditional; }

	get grantsMove() { return this.effect.grantsMove; }

	get isApplied() { return Boolean(this.applied); }

	/** Owed: the sheet can write it, its requirement holds, and it has not been written. */
	get isPending() { return this.earned && this.isAutomatic && !this.isApplied; }

	/**
	 * Owed on the ROW the roll landed on — Raincatching's Surplus, under the 10+ it is printed in.
	 *
	 * Kept apart from `isPending` because the two are owed to different controls: this one is written
	 * from its row and never by the season's batch, which cannot know what was rolled.
	 */
	get isOutcomeOwed() {
		return this.earned && this.effect.isOutcomeArithmetic && !this.isApplied;
	}

	/** Everything a control may write, however it is reached. What applying filters on. */
	get canWrite() { return this.isPending || this.isOutcomeOwed; }

	/** Whether the row this is printed in can offer to write it — owed there, or already written. */
	get isOutcomeArithmetic() { return this.effect.isOutcomeArithmetic; }

	/**
	 * Whether this line can be taken back.
	 *
	 * Not simply "is applied": a record migrated from the old per-slug flag knows THAT it happened and
	 * not WHAT it wrote, so it stays applied and offers no Revert rather than guessing an inverse.
	 */
	get canRevert() { return Boolean(this.applied?.isRevertable); }

	/**
	 * "+1 Surplus", or "Size: town" for a result that sets a rating rather than moving it — the chip
	 * beside the line, as an EffectChip so the rating is named through the same key the board's chips
	 * and the statement's totals use. It was written out here once, which printed the raw `surplus` in
	 * every language.
	 *
	 * No timing on it: on the season's own panel the timing is the panel.
	 */
	get delta() {
		if (this.effect.change) return EffectChip.forChange(this.effect.change);
		return this.effect.set ? EffectChip.forSet(this.effect.set) : null;
	}

	/**
	 * WHEN it fires, as localize keys — `Winter`, `The autumn harvest`, `Every season`.
	 *
	 * Empty for a completion, which has no "when" beyond the heading above it. Rendered only where the
	 * surrounding section does NOT already state the timing: on the season's own panel the timing is
	 * the panel, and repeating "winter" down every line of a winter statement is noise. On an
	 * improvement's card it is the opposite — "Henceforth" says that these fire later without saying
	 * when, and the line's own words no longer say it either, because the trigger was taken out of
	 * them when the payoff prose was stripped.
	 *
	 * Withheld from a line that HAS a phrase, which states the trigger in the book's own words — the
	 * same answer said better. A chip reading "Summer" over a clause opening "when summer comes" is
	 * the scaffolding left standing beside the building, and the surfaces that print a chip are
	 * exactly the ones that print the clause.
	 */
	get timingKeys() { return this.phrase ? [] : EffectChip.timingFor(this.effect.trigger); }

	/**
	 * The Surplus this line moves, where Surplus is what it moves — an amount, or the dice the book
	 * rolls for it. What a step of the season can take up into its own roll (see MomentContribution).
	 */
	get surplusChange() {
		return this.effect.change?.target === "surplus" ? this.effect.change : null;
	}

	/** What it writes onto an evidence list, if anything. */
	get listEntry() { return this.effect.listEntry; }

	/** The step of the season's procedure this result BENDS, if it bends one. */
	get adjustment() { return this.effect.adjustment; }

	/** A bill the steading pays each season for something it built, rather than a step of the move. */
	get isUpkeep() { return this.effect.isUpkeep; }

	/**
	 * Surplus this season pays the steading for something it built — the orchard's +1, the town's
	 * Population+1.
	 *
	 * Collected because they belong to the season's GENERATION, not to a list beside it: the move
	 * already numbers a step for what the season generates, and what the steading generates is the
	 * same act. A bill is not one (it has its own section), and neither is a clause that bends a step
	 * or waits on the move's own roll — each of those has a home of its own already.
	 *
	 * The turn, and only the turn. A MOMENT's payout is the moment's — it is folded into the step that
	 * is that moment, or applied from the moment's own panel where no step numbers it — and treating
	 * it as a gain here would take it out of both.
	 *
	 * A CONDITIONAL payout is not one either. The market's Surplus waits on something the sheet cannot
	 * judge, so it is stated and left to the table, which is what the general list is for; a step that
	 * numbered it would be a step that pays nothing and offers nothing.
	 */
	get isSeasonGain() {
		return this.effect.trigger.kind === "turn" && Boolean(this.surplusChange)
			&& !this.isConditional && !this.isUpkeep && !this.adjustment && !this.isOutcomeGated;
	}

	/** Waiting on the season's own roll — "if you roll a 7+ with Fortunes". */
	get isOutcomeGated() { return this.effect.isOutcomeGated; }

	/** Whether it waits on THIS row of the move's own results. A 7+ answers true to two of them. */
	firesOnTier(tierKey) { return this.effect.firesOnTier(tierKey); }

	/**
	 * Whether the season's own box renders this line somewhere of its own — against the step it
	 * bends, against the roll it waits on, or in the upkeep the steading owes.
	 *
	 * The general list asks so it can leave those out: a result stated in both places is the
	 * undifferentiated wall this was rebuilt to remove. An improvement's own card asks nothing and
	 * shows everything, because there are no steps there to collect them under.
	 */
	get isStepBound() {
		return Boolean(this.adjustment) || this.isUpkeep || this.isOutcomeGated || this.isSeasonGain;
	}

	static idFor(improvementSlug, index) { return `${improvementSlug}:${index}`; }

	/**
	 * `mill:2` → `{slug: "mill", index: 2}`, or null.
	 *
	 * Split on the LAST colon: every improvement slug in the pack is hyphenated, but a slug is also
	 * the one part of this id someone could author by hand on a custom improvement, and a colon in it
	 * would otherwise silently address a different result.
	 */
	static parseId(id) {
		const at = String(id ?? "").lastIndexOf(":");
		if (at <= 0) return null;
		const index = Number(id.slice(at + 1));
		return Number.isInteger(index) && index >= 0 ? { slug: id.slice(0, at), index } : null;
	}
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
	 * @param stated  nothing in this statement is applied HERE.
	 *
	 * `stated` is what an improvement's **Henceforth** half is: its results are real and seven of them
	 * are plain arithmetic, but they fire at the turn of the season, and the season's own panel is
	 * where the table applies them. Listed on the card so the payoff reads whole — with no control,
	 * because a control there would apply them early and then again in the season that owns them.
	 */
	constructor(lines = [], ratings = {}, { stated = false } = {}) {
		this.lines    = lines;
		this._ratings = ratings;
		this._stated  = stated;
	}

	get isEmpty()  { return this.lines.length === 0; }

	/**
	 * Lines this statement can write — the ones that get a control.
	 *
	 * Every question about what Apply would do runs through here, so the three ways a line can be
	 * shown-but-not-written (its requirement does not hold; this is not the surface that writes it;
	 * the season's generation step writes it) are answered once rather than in four getters that
	 * could drift apart.
	 *
	 * A GAIN is left out for a different reason from the other two: it is written, but by the step
	 * that generates it, whose record is a step record and not a per-line one. Counting it here as
	 * well would let "Apply the season" pay a Surplus the generation step had already paid.
	 */
	get automatic() {
		return this._stated ? [] : this.lines.filter(l => l.isAutomatic && l.earned && !l.isSeasonGain);
	}

	/**
	 * Stated with their source and left to the table: rolled, conditional, adjusting, or fiction.
	 *
	 * A line that confers a MOVE is none of those and is not here: it renders as that move's own row,
	 * so listing it would print a fragment of the move beside the move.
	 */
	get advisory() {
		const applicable = new Set(this.automatic);
		return this.lines.filter(l => !applicable.has(l) && !l.grantsMove);
	}

	get hasAutomatic() { return this.automatic.length > 0; }

	/** Results that bend a step, in the order the steps are named. Never applied, never counted. */
	get adjustments() { return this.lines.filter(l => l.adjustment); }

	/** The steading's own bills for the season — the watch's Surplus, the militia's practice. */
	get upkeep() { return this.lines.filter(l => l.isUpkeep); }

	/** Results waiting on the season's own roll — they belong beside the step that rolls it. */
	get outcomeGated() { return this.lines.filter(l => l.isOutcomeGated); }

	/** What the steading's own buildings generate this season — the season's generation step's. */
	get gains() { return this.lines.filter(l => l.isSeasonGain && l.earned); }

	/**
	 * The lines a general list shows: everything the season's own steps do not show themselves.
	 *
	 * Both halves are filtered the same way, so a line moved to a step leaves the list from whichever
	 * half it was in. Nothing is removed from `automatic` itself — the season's Apply still writes the
	 * upkeep, and the totals still count it, because the section it moved to is still this season's.
	 */
	get owed()         { return this.automatic.filter(l => !l.isStepBound); }
	get advisoryOwed() { return this.advisory.filter(l => !l.isStepBound); }

	/** Still owed — what an "apply all" would write, and nothing already written. */
	get pending() { return this.automatic.filter(l => !l.isApplied); }

	/** Whether anything would actually change if Apply were pressed now. */
	get willChangeAnything() { return this.pending.length > 0; }

	/** Every line this statement can write has been written. */
	get isFullyApplied() { return this.hasAutomatic && this.pending.length === 0; }

	/**
	 * The net effect on each rating, in the order the ratings are named — before and after, so the
	 * table sees the consequence rather than a list of deltas to add up themselves.
	 *
	 * Only PENDING lines count: an advisory line never wrote anything, and an applied one already
	 * has, so counting either would state a change that is not about to happen.
	 */
	get totals() {
		const deltas = new Map();
		for (const line of this.pending) {
			const { change, set } = line.effect;
			if (change) {
				deltas.set(change.target, (deltas.get(change.target) ?? 0) + change.amount);
			} else if (set?.isNumeric) {
				// A set stated as the delta that reaches it, so the footer still reads "3 → 0" without a
				// second row shape. Size is left out: it is a tier word, and "hamlet → town" is not
				// arithmetic anybody needs adding up.
				deltas.set(set.target, set.value - (this._ratings[set.target] ?? 0));
			}
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

	/** The evidence-list entries the pending lines would add. */
	get listEntries() {
		return this.pending.filter(l => l.listEntry).map(l => l.listEntry);
	}
}
