import { TIER_KEYS } from "../MoveResults.js";

/**
 * Which roll of a season's procedure a record belongs to: a step, by its index in the move's own
 * steps, or one tier of that step's results.
 *
 * Winter rolls 1d4+Population twice — once as its opening step, and again on a 7-9 or a 6- — and
 * both move Surplus, so each needs a record of its own that can be undone on its own. An index alone
 * cannot say which of the two, and the alternative was a bare composite string handed between the
 * template, the sheet and the store, with each of the three knowing how to take it apart.
 *
 * `key` is that string, produced in one place: it is what `system.seasonStepsApplied` is keyed by,
 * and a plain index is still written as a plain index, so every record made before tiers existed is
 * still addressed by the address it was stored under.
 */
export class SeasonStepAddress {
	constructor(index, tier = null) {
		this.index = index;
		this.tier  = tier;
	}

	get key()    { return this.tier ? `${this.index}:${this.tier}` : String(this.index); }
	get isTier() { return this.tier !== null; }

	/** A step, or one of its tiers — null for an index that is not one, or a tier that is not a tier. */
	static of(index, tier = null) {
		if (!Number.isInteger(index) || index < 0) return null;
		if (tier !== null && !TIER_KEYS.includes(tier)) return null;
		return new SeasonStepAddress(index, tier);
	}

	/** As a control carries it — `data-step="4"`, `data-step="4:partial"`. */
	static parse(raw) {
		if (raw instanceof SeasonStepAddress) return raw;
		if (typeof raw !== "string" && !Number.isInteger(raw)) return null;
		const [index, tier = null, ...rest] = String(raw).split(":");
		// An empty string is not the step at index 0, which is what Number("") would make it.
		if (rest.length || !/^\d+$/.test(index)) return null;
		return SeasonStepAddress.of(Number(index), tier);
	}
}
