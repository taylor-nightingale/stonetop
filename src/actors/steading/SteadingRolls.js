import { hinderRollMode } from "../hinderRollMode.js";

const _localize = (key) => globalThis.game?.i18n?.localize?.(key) ?? key;

// What the steading's ratings are worth when something rolls them. Its own class because it is the
// one place the debilities bend a number: Lacking costs Prosperity 1, and a hindering debility turns
// a normal roll into a disadvantaged one.
export class SteadingRolls {
	/* Keys, never words. These four names reach the player through the stat-pick dialog (a move that
	   rolls "ask"), so an English word here was an English button on an otherwise translated
	   steading — and `stonetop.steading.attr.*` already held the translations the sheet itself draws
	   its rating tiles from. One source for the name of a rating, wherever it is shown. */
	static ROLLABLE = [
		{ key: "population", nameKey: "stonetop.steading.attr.population" },
		{ key: "prosperity", nameKey: "stonetop.steading.attr.prosperity" },
		{ key: "defenses",   nameKey: "stonetop.steading.attr.defenses" },
		{ key: "fortunes",   nameKey: "stonetop.steading.attr.fortunes" },
	];

	constructor(actor, debilities) {
		this._actor      = actor;
		this._debilities = debilities;
	}

	rollableStats() {
		return SteadingRolls.ROLLABLE.map(({ key, nameKey }) =>
			({ key, name: _localize(nameKey), value: this.resolveBonus(key) ?? 0 }));
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
