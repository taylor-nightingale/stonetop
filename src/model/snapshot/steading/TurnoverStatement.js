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
	}

	/** Arithmetic the sheet can do. Advisory lines carry no control and are never counted. */
	get isAutomatic() { return this.effect.isAutomatic; }

	get condition()  { return this.effect.condition; }
	get grantsMove() { return this.effect.grantsMove; }

	get isApplied() { return Boolean(this.applied); }

	/** Owed: the sheet can write it, its requirement holds, and it has not been written. */
	get isPending() { return this.earned && this.isAutomatic && !this.isApplied; }

	/**
	 * Whether this line can be taken back.
	 *
	 * Not simply "is applied": a record migrated from the old per-slug flag knows THAT it happened and
	 * not WHAT it wrote, so it stays applied and offers no Revert rather than guessing an inverse.
	 */
	get canRevert() { return Boolean(this.applied?.isRevertable); }

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

	/**
	 * WHEN it fires, as localize keys — `Winter`, `The autumn harvest`, `Every season`.
	 *
	 * Empty for a completion, which has no "when" beyond the heading above it. Rendered only where the
	 * surrounding section does NOT already state the timing: on the season's own panel the timing is
	 * the panel, and repeating "winter" down every line of a winter statement is noise. On an
	 * improvement's card it is the opposite — "Henceforth" says that these fire later without saying
	 * when, and the line's own words no longer say it either, because the trigger was taken out of
	 * them when the payoff prose was stripped.
	 */
	get timingKeys() { return EffectChip.timingFor(this.effect.trigger); }

	/** What it writes onto an evidence list, if anything. */
	get listEntry() { return this.effect.listEntry; }

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
	 * Every question about what Apply would do runs through here, so the two ways a line can be
	 * shown-but-not-written (its requirement does not hold; this is not the surface that writes it)
	 * are answered once rather than in four getters that could drift apart.
	 */
	get automatic() { return this._stated ? [] : this.lines.filter(l => l.isAutomatic && l.earned); }

	/** Stated with their source and left to the table: rolled, conditional, adjusting, or fiction. */
	get advisory() {
		const applicable = new Set(this.automatic);
		return this.lines.filter(l => !applicable.has(l));
	}

	get hasAutomatic() { return this.automatic.length > 0; }

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
			if (!line.effect.change) continue;
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

	/** The evidence-list entries the pending lines would add. */
	get listEntries() {
		return this.pending.filter(l => l.listEntry).map(l => l.listEntry);
	}
}
