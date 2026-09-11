/**
 * What one dice-rolling step of a Seasons Change move actually did to Surplus.
 *
 * The roll used to post a card and quietly move the number, which left no answer to either "what
 * happened?" or "undo that". This is the record: the dice total, what the step called for once the
 * steading's own improvements had their say, the value before and after, and the signed delta
 * actually applied — which is NOT always the total, because consumption floors at 0
 * ("if there's not enough, reduce Surplus to 0"). Reverting adds the delta back rather than restoring
 * `from`, so a steading whose Surplus was edited in between is corrected by the amount this step took
 * rather than overwritten with a stale number.
 *
 * Season-scoped, like the turnover's own record: the wheel turning clears it, because next winter's
 * consumption is a new roll and not a re-run of this one.
 */
export class AppliedStepRoll {
	constructor({ total = null, due = null, from = 0, to = 0 } = {}) {
		// What the dice said, or null for a step that rolls none — the season's gains in a spring that
		// generates nothing of its own are applied, not rolled. Null rather than 0 because a rolled 0
		// is a real answer (1d4-1 rolls one), and a step that reported "0 was rolled" under a line
		// that never called for dice would be inventing a roll nobody made.
		this.total = total;
		// What the step actually called for once the improvements had their say — the total, unless
		// something the steading built reduced it. Recorded as well as the dice, because "6 was
		// rolled; there was not enough" is only true against the amount that was OWED: a stone wall
		// consumes 1 less than it rolls, and comparing a 6 with a 5 paid would have called every
		// adjusted winter short.
		this.due   = Number.isFinite(due) ? due : (total ?? 0);
		this.from  = from;
		this.to    = to;
	}

	/** Whether dice were thrown for this at all. */
	get wasRolled() { return Number.isFinite(this.total); }

	/** Whether an improvement changed what this roll cost — the step says so where it did. */
	get wasAdjusted() { return this.wasRolled && this.due !== this.total; }

	/** Signed, and the amount to give back: negative for a step that spent, positive for one that paid. */
	get delta() { return this.to - this.from; }

	/** What it moved, unsigned — the number a reader reads. */
	get amount() { return Math.abs(this.delta); }

	get isSpend() { return this.delta < 0; }

	/** Whether the roll moved nothing at all — a total of 0, or one an improvement adjusted down to 0. */
	get isUnchanged() { return this.delta === 0; }

	/**
	 * Whether the roll cost more than the steading had. The book's answer is Meet with Disaster, which
	 * the sheet names and the table plays out.
	 *
	 * Read off `to` rather than off `isSpend`, because a consumption against 0 Surplus takes nothing
	 * and so is not a spend: 3 owed by a steading with none moves no number, and asking `isSpend`
	 * called that a quiet gain of nothing and said neither what was owed nor that it went unpaid.
	 * Nothing but a consumption reaches this branch — a gain always lifts `to` above `from`.
	 */
	get wasShort() { return this.delta <= 0 && this.to === 0 && this.due > this.amount; }

	get labelKey() {
		const KEYS = "stonetop.steading.seasons.steps.applied";
		if (this.isUnchanged) return `${KEYS}.unchanged`;
		return this.isSpend ? `${KEYS}.spent` : `${KEYS}.gained`;
	}

	toObject() { return { total: this.total, due: this.due, from: this.from, to: this.to }; }

	static fromRaw(raw) {
		if (!raw || !Number.isFinite(raw.from) || !Number.isFinite(raw.to)) return null;
		return new AppliedStepRoll({
			total: Number.isFinite(raw.total) ? raw.total : null,
			due: raw.due ?? null, from: raw.from, to: raw.to,
		});
	}
}
