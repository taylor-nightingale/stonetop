import { rich } from "../snapshot/RichText.js";

/** The tiers a 2d6 move lands in, best first — the order every surface prints them in. */
export const TIER_KEYS = ["success", "partial", "failure"];

/**
 * The notation each tier is printed with when the move itself authors none — a homebrew move, or one
 * being written on its own sheet for the first time. Deliberately untranslated, like the authored
 * labels they stand in for (see translatablePaths): 10+ is 10+ in every language the book is read in.
 */
export const DEFAULT_TIER_LABELS = { success: "10+", partial: "7-9", failure: "6-" };

/**
 * One authored result of a move: what the move calls that tier, and what it says happens there.
 *
 * The label is the move's own — dice notation, deliberately left untranslated (see
 * translatablePaths) — rather than a constant here, so a homebrew move that scores itself
 * differently says so on every surface at once. The default stands in only where a move authored
 * nothing, so a result row is never a blank band beside a sentence.
 */
export class MoveResultTier {
	constructor({ key, label = "", text = "" }) {
		this.key   = key;
		this.label = label || DEFAULT_TIER_LABELS[key] || "";
		this.text  = rich(text);
	}
}

/**
 * A move's three result tiers, as the move authors them in `system.moveResults`.
 *
 * One class because two surfaces read the same authored field. A description-only chat card prints
 * every tier; the Seasons Change box draws them as the rows of its own roll, with whatever mechanics
 * the season's step hangs on them. Both were about to keep their own copy of the tier order and
 * their own idea of what a row is, and winter's results would then have been authored twice.
 *
 * A tier with no words is dropped rather than rendered blank: a move that fills in only its 10+ has
 * two empty results, not three.
 */
export class MoveResults {
	constructor(tiers = []) {
		this.tiers = tiers;
	}

	static fromRaw(raw) {
		if (!raw) return null;
		const tiers = TIER_KEYS
			.filter(key => raw[key]?.value)
			.map(key => new MoveResultTier({ key, label: raw[key].label ?? "", text: raw[key].value }));
		return tiers.length ? new MoveResults(tiers) : null;
	}

	get isEmpty() { return this.tiers.length === 0; }

	byKey(key) { return this.tiers.find(tier => tier.key === key) ?? null; }
}
