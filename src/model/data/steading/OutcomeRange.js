import { TIER_KEYS } from "../MoveResults.js";

/**
 * The results of the season's OWN roll that a clause waits on — Raincatching's "if you roll a 7+
 * with Fortunes".
 *
 * Authored in the book's notation, because that is what the clause says and what the move's own
 * result rows are labelled with. What the sheet needs from it is which of those rows the clause
 * belongs under, and "7+" is two of them: a steading that rolls 7-9 gets its Surplus just as one
 * that rolls 10+ does, so the line is read under whichever row the dice actually land on.
 *
 * Not `RollOutcome` (src/actors/RollOutcome.js), which answers the other question: that one is the
 * tier a roll DID land in, this one is the tiers a clause is waiting for.
 */
const RANGES = {
	"10+": ["success"],
	"7+":  ["success", "partial"],
	"7-9": ["partial"],
	"6-":  ["failure"],
};

export class OutcomeRange {
	constructor(label, tierKeys) {
		// The book's own notation — "7+". Kept because it is what the clause says, and the sheet has
		// no better words for it than the ones the move's rows are already labelled with.
		this.label    = label;
		this.tierKeys = tierKeys;
	}

	/** Whether this range covers one of the move's result rows. */
	includes(tierKey) { return this.tierKeys.includes(tierKey); }

	/**
	 * A notation the move's rows can be found by, or null.
	 *
	 * Null for anything unrecognised — a homebrew improvement scoring itself some other way. The
	 * clause is then not outcome-gated at all, so it falls back to the ordinary advisory list with
	 * its condition stated as "only if …", which is where every clause the sheet cannot place goes.
	 * Filing it under no row at all would be the one outcome that loses it.
	 */
	static fromRaw(raw) {
		const label = typeof raw === "string" ? raw.trim() : "";
		const tiers = RANGES[label]?.filter(key => TIER_KEYS.includes(key)) ?? null;
		return tiers?.length ? new OutcomeRange(label, tiers) : null;
	}
}
