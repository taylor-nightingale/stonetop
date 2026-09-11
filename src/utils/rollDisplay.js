export class RollDisplay {
	constructor(localize) {
		this._localize = localize;
	}

	/**
	 * Build the dice view model for the chat card (data, not HTML — the template renders it).
	 * `move-roll.hbs` turns this into the dice row; game text (name/description/resultText) is added
	 * by the caller as RichText.
	 *
	 * `formula` is the roll in the words the sheet offered it in — "1d4 + Population" — for a roll
	 * whose card is titled by what it DID rather than by what it rolled.
	 */
	build(roll, {rollMode, statKey, formula = null} = {}) {
		const parts = RollDisplay._tooltipParts(roll);

		const modeLabel =
			rollMode === "adv" ? this._localize("stonetop.rollMode.adv") :
			rollMode === "dis" ? this._localize("stonetop.rollMode.dis") :
			null;

		return {
			rolls: parts.flatMap(part => part.rolls),
			modeLabel,
			formula,
			mod: this._modFor(RollDisplay._modifierOf(roll, parts), statKey, formula),
			total: roll.total,
			rollMode: rollMode ?? "normal",
		};
	}

	/**
	 * Every die of the roll, in the order it was rolled, each carrying the classes CORE gives it.
	 *
	 * Asked of the dice rather than derived here: `getTooltipData` is what draws Foundry's own dice,
	 * and its classes carry the die's size, whether it was the highest or lowest face it could show,
	 * and whether a keep-modifier discarded it. The card used to sort the dropped dice of a 3d6kh2
	 * into a second group with a "|" before them and grey them out by hand — which named none of
	 * those things, moved the dropped die out of the position it was actually rolled in, and knew
	 * about exactly one modifier.
	 */
	static _tooltipParts(roll) {
		return roll.dice.map(die => die.getTooltipData());
	}

	/**
	 * The modifier the card prints. Named where the roll came from a rating — "+2 (WIS)" — and bare
	 * where it came from a formula, which is what a season step's "+ Population" resolves to.
	 *
	 * Anything that NAMED a modifier prints one, zero included: a rating at 0 is the answer to why a
	 * 7 was a 7, and a card headed "1d4 + Population" that then shows nothing for Population has the
	 * same hole in it. A bare 2d6 or damage die named none, so it prints none.
	 */
	_modFor(modifier, statKey, formula) {
		if (statKey != null) return `${RollDisplay._signed(modifier)} (${statKey.toUpperCase()})`;
		if (formula == null && modifier === 0) return null;
		return RollDisplay._signed(modifier);
	}

	/**
	 * What the dice did not account for: the total, less what every dice term of it came to.
	 *
	 * DERIVED rather than passed in, because every path here already knows both, and only one of the
	 * three used to be told the bonus — which is why a season step's card showed a 1 beside a total
	 * of 0 and nothing to explain the difference. Off the terms' own totals, so a term that keeps
	 * only some of its dice is counted at what it kept.
	 */
	static _modifierOf(roll, parts) {
		return roll.total - parts.reduce((sum, part) => sum + part.total, 0);
	}

	static _signed(n) {
		return `${n >= 0 ? "+" : ""}${n}`;
	}
}
