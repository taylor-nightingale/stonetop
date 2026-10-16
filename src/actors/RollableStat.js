/** A rating an actor can roll with — what a stat-choice dialog offers and what its tile shows. */
export class RollableStat {
	constructor(key, name, value, abbr = null) {
		this.key   = key;
		this.name  = name;
		this.value = value;
		this.abbr  = abbr;
	}

	get shortName() {
		return this.abbr ?? this.name;
	}

	get signedValue() {
		return `${this.value >= 0 ? "+" : ""}${this.value}`;
	}

	/** Rolled +this stat, before any mode: "2d6 + 2", "2d6 − 1". */
	get rollFormula() {
		return `2d6 ${this.value >= 0 ? "+" : "\u2212"} ${Math.abs(this.value)}`;
	}
}
