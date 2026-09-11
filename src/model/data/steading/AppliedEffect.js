/**
 * The record of what ONE result actually wrote to the steading.
 *
 * Apply used to be a one-way door: it summed a statement into a single update and stored
 * `improvementsApplied.<slug> = true`. That records THAT something happened and nothing about WHAT,
 * so a mis-click could not be undone through the sheet — and on a document six people share, a
 * mis-click is not a hypothetical.
 *
 * So the sheet stores the write itself. Revert then subtracts exactly what was added, rather than
 * recomputing what the effect "would" write now: the improvement's requirements may have moved since,
 * the rating may have been edited by hand, and a recomputed inverse would silently disagree with the
 * original by however much the world has drifted.
 *
 * A `legacy` record is one migrated from the old per-slug flag. It says "this was applied" and
 * cannot say what it wrote, so it is deliberately not revertable — inventing an inverse for it would
 * be a guess that looks like a fact.
 */
export class AppliedEffect {
	constructor({ change = null, set = null, entry = null, legacy = false }) {
		// {target, amount} — the rating delta this line added.
		this.change = change;
		// {target, from, to} — the rating this line SET, and what it was before.
		//
		// `from` is the whole reason a set is recorded differently from a delta. A delta inverts by
		// arithmetic against whatever the rating holds now; a set overwrote a value, and the only way
		// back is to have kept it. Township turning Population to +0 is otherwise a one-way door.
		this.set    = set;
		// {list, text} — the entry this line appended to one of the evidence lists.
		this.entry  = entry;
		this.legacy = legacy;
	}

	/**
	 * What a line will write, recorded at the moment it is applied.
	 *
	 * Only the halves the sheet actually performs: a rolled amount, a condition it cannot evaluate and
	 * an adjustment to a step it never runs all write nothing, so there is nothing to record and
	 * nothing to revert.
	 *
	 * @param from  the value a SET is about to replace, supplied by the caller rather than read here —
	 *              the same reason inverseUpdate takes the current state, and what lets a caller
	 *              applying several lines at once record each against the value its own turn saw.
	 */
	static fromLine(line, { from = undefined } = {}) {
		const change = line.effect.change?.isAutomatic
			? { target: line.effect.change.target, amount: line.effect.change.amount }
			: null;
		const written = line.effect.set;
		const set = written
			? { target: written.target, from: from ?? written.unsetValue, to: written.value }
			: null;
		const entry = line.listEntry ? { list: line.listEntry.list, text: line.listEntry.text } : null;
		return new AppliedEffect({ change, set, entry });
	}

	/** A record as stored. Anything unrecognised reads as a legacy apply rather than as nothing. */
	static fromRaw(raw) {
		if (!raw) return null;
		if (raw === true) return new AppliedEffect({ legacy: true });
		return new AppliedEffect({
			change: raw.change?.target && Number.isInteger(raw.change?.amount)
				? { target: raw.change.target, amount: raw.change.amount }
				: null,
			// `from` may legitimately be 0 or "" — the two values a rating reads as when it was never
			// set — so its presence is what is checked, never its truth.
			set: raw.set?.target && raw.set.from !== undefined && raw.set.to !== undefined
				? { target: raw.set.target, from: raw.set.from, to: raw.set.to }
				: null,
			entry: raw.entry?.list && typeof raw.entry?.text === "string"
				? { list: raw.entry.list, text: raw.entry.text }
				: null,
			legacy: Boolean(raw.legacy),
		});
	}

	toRaw() {
		return {
			...(this.change ? { change: { ...this.change } } : {}),
			...(this.set    ? { set:    { ...this.set } }    : {}),
			...(this.entry  ? { entry:  { ...this.entry } }  : {}),
			...(this.legacy ? { legacy: true } : {}),
		};
	}

	/** Whether this record can be undone — it knows what it wrote, and it wrote something. */
	get isRevertable() { return !this.legacy && Boolean(this.change || this.set || this.entry); }

	/**
	 * The update that undoes this, against what the steading currently holds.
	 *
	 * Takes the current state rather than reading it, so the arithmetic is testable without an actor
	 * and so a caller reverting several lines at once can fold them together itself.
	 */
	inverseUpdate({ attributes = {}, assets = {} } = {}) {
		if (!this.isRevertable) return {};
		if (this.change) {
			const target = this.change.target;
			return { [`system.attributes.${target}`]: (attributes[target] ?? 0) - this.change.amount };
		}
		// Restored, not recomputed: what a set replaced is the only inverse it has, and it was kept at
		// apply time for exactly this. Unlike a delta this ignores where the rating stands now — a set
		// asserted a value, so undoing it asserts the previous one.
		if (this.set) return { [`system.attributes.${this.set.target}`]: this.set.from };
		// Removed by VALUE, not by position: the list is edited by hand between seasons, and an index
		// recorded at apply time would by now point at somebody else's entry.
		return {
			[`system.assets.${this.entry.list}`]:
				(assets[this.entry.list] ?? []).filter(text => text !== this.entry.text),
		};
	}
}
