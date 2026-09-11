/**
 * What the steading has BUILT that belongs to one step of the season, and what the step's own roll
 * makes of it.
 *
 * Two things arrive this way, and they are the same thing seen twice:
 *
 *   a MOMENT the move numbers — autumn's fourth step IS the harvest, and the Mill's +1, the
 *   orchard's +1 and Greater Harvest's +1d4 are part of that harvest, not a second event under it.
 *
 *   the season's GAINS — what the steading generates when the wheel turns. Township's Population+1,
 *   the orchard's summer Surplus. The move already numbers a step for what the SEASON generates, and
 *   what the steading generates is that same act.
 *
 * Both used to sit apart from the step with an Apply of their own, so the table rolled the season,
 * applied it, then scrolled to a list and applied the rest: one event, paid twice, in two places.
 *
 * So they go into the step. An integer moves what it pays, exactly as a step adjustment does (the
 * Golden Sapling's +1 has always worked this way); a rolled amount joins the dice, so the control
 * offers `1d4 + 1d4` and one roll answers the whole harvest. Nothing here has a control of its own —
 * the step's own control is the act, and reverting it gives back everything it wrote.
 *
 * What the roll cannot take is stated instead, in the book's words, with no control: a clause with a
 * condition the sheet cannot evaluate, one that writes to a list, or one on the wrong side of the
 * season (see `_takes`).
 */
export class StepContribution {
	constructor({ taken = [], stated = [], moment = null }) {
		// The lines the step takes up, and the lines it cannot. Both are READ under the step: what the
		// steading brings is one list, and which half a clause is in shows in the dice rather than in a
		// heading.
		this.taken  = taken;
		this.stated = stated;
		// The MomentSnapshot this came from, where it came from one — its statement still carries the
		// moves a moment can hand the table, which are rolled and never applied.
		this.moment = moment;
	}

	/** The moment this claims, or null for the season's own gains — what keeps a panel from repeating it. */
	get momentKey() { return this.moment?.key ?? null; }
	get statement() { return this.moment?.statement ?? null; }

	/** Every clause, in the order the season states them — what the step draws. */
	get lines() { return [...this.taken, ...this.stated]; }

	get hasLines() { return this.lines.length > 0; }

	/** What the step owes on top of its own dice — the Mill's +1, the town's Population+1. */
	get delta() {
		return this.taken.reduce((total, line) => total + (line.surplusChange?.amount ?? 0), 0);
	}

	/** The dice the clauses add to the step's own — Greater Harvest's 1d4. */
	get dice() {
		return this.taken.map(line => line.surplusChange?.formula).filter(Boolean);
	}

	/** The improvements the step owes something to, by name — what says its dice were bent at all. */
	get sources() { return this.taken.map(line => line.source); }

	/**
	 * What a step that IS a moment brings, or null where the step is not one or nothing fires at it.
	 *
	 * A moment with no step of its own — the gathering at the inn, the aurochs hunt in a spring whose
	 * move does not number it — is not claimed here and keeps its own panel, with its own Apply.
	 */
	static forMoment(step, moments = []) {
		if (step?.kind !== "moment" || !step.moment) return null;
		const moment = moments.find(m => m.key === step.moment);
		if (!moment) return null;
		return StepContribution._from(step, (moment.statement?.lines ?? []), moment);
	}

	/** What the season's own generation step pays out beyond the move's — null where nothing does. */
	static forGains(step, gains = []) {
		if (step?.kind !== "generate" || !gains.length) return null;
		return StepContribution._from(step, gains);
	}

	static _from(step, lines, moment = null) {
		// A granted move is rolled, and what it does depends on the roll — it renders as that move's
		// own row rather than as a clause with an amount.
		const own = lines.filter(line => !line.grantsMove);
		return new StepContribution({
			moment,
			taken:  own.filter(line => StepContribution._takes(line, step)),
			stated: own.filter(line => !StepContribution._takes(line, step)),
		});
	}

	/**
	 * Whether the step can take one clause up.
	 *
	 * Surplus, on the generating side of the season, unconditionally. The three restrictions are the
	 * same judgement the rest of the sheet makes: a condition the sheet cannot evaluate is stated and
	 * never applied; a clause that writes to a list is not an amount; and a moment on the CONSUMING
	 * side would need this to decide whether "+1 Surplus" means one more consumed or one less, which
	 * is a guess. Nothing in the book asks for that guess — every moment the four moves number is a
	 * harvest — so it is stated rather than answered.
	 */
	static _takes(line, step) {
		return step.affects === "generation" && !line.isConditional && Boolean(line.surplusChange);
	}
}
