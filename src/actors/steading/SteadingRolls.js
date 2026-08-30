import { hinderRollMode } from "../hinderRollMode.js";

// What the steading's ratings are worth when something rolls them. Its own class because it is the
// one place the debilities bend a number: Lacking costs Prosperity 1, and a hindering debility turns
// a normal roll into a disadvantaged one.
export class SteadingRolls {
	static ROLLABLE = [
		{ key: "population", name: "Population" },
		{ key: "prosperity", name: "Prosperity" },
		{ key: "defenses",   name: "Defenses" },
		{ key: "fortunes",   name: "Fortunes" },
	];

	constructor(actor, debilities) {
		this._actor      = actor;
		this._debilities = debilities;
	}

	rollableStats() {
		return SteadingRolls.ROLLABLE.map(({ key, name }) => ({ key, name, value: this.resolveBonus(key) ?? 0 }));
	}

	// Null when the steading has no such rating at all, which keeps "not a stat" distinct from a
	// rating sitting at 0.
	resolveBonus(rollStat) {
		const stored = this._actor.system.attributes?.[rollStat] ?? null;
		if (stored === null) return null;
		return stored + (this.adjustmentFor(rollStat)?.delta ?? 0);
	}

	// What a debility is currently costing a rating, and which one is costing it — so a sheet can
	// say "+1 −1 lacking" rather than silently showing a different number than the one stored.
	// Null when nothing bends this rating.
	adjustmentFor(rollStat) {
		if (rollStat === "prosperity" && this.isLacking) return { delta: -1, debility: "lacking" };
		return null;
	}

	applyRollMode(rollStat, rollMode, moveSlug = null) {
		return this._debilities.hindersMove(moveSlug) ? hinderRollMode(rollMode) : rollMode;
	}

	get prosperity() {
		return this.resolveBonus("prosperity") ?? 0;
	}

	get isLacking() {
		return this._debilities.isActive("lacking");
	}
}
