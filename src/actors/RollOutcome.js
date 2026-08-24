/**
 * The tier a 2d6 move roll landed in: which result text applies, what the card calls it, and
 * whether the book's mark-XP-on-a-miss rule is in play. One object so the thresholds and the
 * three labels live together rather than as parallel ternaries at the roll site.
 */

const TIERS = [
	{ min: 10, key: "success", labelKey: "stonetop.rollResults.strongHit" },
	{ min: 7,  key: "partial", labelKey: "stonetop.rollResults.weakHit"   },
	{ min: -Infinity, key: "failure", labelKey: "stonetop.rollResults.miss" },
];

export class RollOutcome {
	constructor(key, label) {
		this.key = key;
		this.label = label;
	}

	static fromTotal(total, localize) {
		const tier = TIERS.find(t => total >= t.min);
		return new RollOutcome(tier.key, localize(tier.labelKey));
	}

	get isMiss() {
		return this.key === "failure";
	}
}
