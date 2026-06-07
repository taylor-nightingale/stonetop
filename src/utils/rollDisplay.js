export class RollDisplay {
	constructor(localize) {
		this._localize = localize;
	}

	build(roll, {name, rollMode, bonus, statKey, resultKey, description, resultText} = {}) {
		const allResults = roll.dice.flatMap(d => d.results);
		const hasDropped = allResults.some(r => !r.active);

		const groups = hasDropped
			? [
				{kept: true,  values: allResults.filter(r =>  r.active).map(r => ({value: r.result}))},
				{kept: false, values: allResults.filter(r => !r.active).map(r => ({value: r.result}))},
			]
			: [{kept: true, values: allResults.map(r => ({value: r.result}))}];

		const keptCount = groups.filter(g => g.kept).length;

		const groupsHtml = groups.map((group, i) => {
			const sep = (hasDropped && i === keptCount)
				? `<span class="stonetop-dice-separator">|</span>`
				: "";
			const diceHtml = group.values.map(({value}) =>
				`<span class="stonetop-die${group.kept ? "" : " stonetop-die--dropped"}">${value}</span>`
			).join("");
			const groupClass = `stonetop-dice-group${group.kept ? "" : " stonetop-dice-group--dropped"}`;
			return `${sep}<span class="${groupClass}">${diceHtml}</span>`;
		}).join("");

		const modeLabel =
			rollMode === "adv" ? this._localize("stonetop.rollMode.adv") :
			rollMode === "dis" ? this._localize("stonetop.rollMode.dis") :
			null;

		const modeHtml = modeLabel
			? `<span class="stonetop-roll-mode stonetop-roll-mode--${rollMode}">${modeLabel}</span>`
			: "";

		const modHtml = statKey != null
			? `<span class="stonetop-roll-mod">${bonus >= 0 ? "+" : ""}${bonus} (${statKey.toUpperCase()})</span>`
			: "";

		const diceSection = `<div class="stonetop-roll-dice">${modeHtml}${groupsHtml}${modHtml}<span class="stonetop-roll-total">= ${roll.total}</span></div>`;

		const parts = [`<h3>${name}</h3>`, diceSection];
		if (description) parts.push(description);
		if (resultText)  parts.push(`<div class="stonetop-move-result stonetop-move-result--${resultKey}">${resultText}</div>`);

		return parts.join("");
	}
}
