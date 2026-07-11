import {buildXpLine} from "../chat/xpMarkControl.js";

export class RollDisplay {
	constructor(localize) {
		this._localize = localize;
	}

	// Build the dice view model for the chat card (data, not HTML — the template renders it).
	// `move-roll.hbs` turns this into the dice row; game text (name/description/resultText) is added
	// by the caller as RichText.
	build(roll, {rollMode, bonus, statKey} = {}) {
		const allResults = roll.dice.flatMap(d => d.results);
		const hasDropped = allResults.some(r => !r.active);

		const diceGroups = hasDropped
			? [
				{kept: true,  values: allResults.filter(r =>  r.active).map(r => r.result)},
				{kept: false, values: allResults.filter(r => !r.active).map(r => r.result)},
			]
			: [{kept: true, values: allResults.map(r => r.result)}];

		const modeLabel =
			rollMode === "adv" ? this._localize("stonetop.rollMode.adv") :
			rollMode === "dis" ? this._localize("stonetop.rollMode.dis") :
			null;

		const mod = statKey != null ? `${bonus >= 0 ? "+" : ""}${bonus} (${statKey.toUpperCase()})` : null;

		return {diceGroups, modeLabel, mod, total: roll.total, rollMode: rollMode ?? "normal"};
	}
}
