/**
 * Builds the HTML content string for a 2d6 roll chat card.
 *
 * Pure function — no Foundry globals. Works for both move rolls and stat rolls.
 *
 * @param {object} roll     - Roll object with .dice (array of Die) and .total
 * @param {object} options
 * @param {string}  options.name        - Full heading text (includes stat and result tier)
 * @param {string}  [options.rollMode]  - "adv" | "dis" | "def" | "normal"
 * @param {number}  [options.bonus]     - Numeric modifier (null/undefined = omit modifier)
 * @param {string}  [options.statKey]   - Stat key for modifier label (e.g. "wis")
 * @param {string}  [options.resultKey] - "success" | "partial" | "failure"
 * @param {string}  [options.description] - Move description HTML
 * @param {string}  [options.resultText]  - Move result text
 * @returns {string} HTML content string
 */
export function buildRollContent(roll, { name, rollMode, bonus, statKey, resultKey, description, resultText } = {}) {
	// Group each Die term so kept/dropped pairs stay together visually
	const groups = roll.dice
		.map(d => ({
			kept:   d.results.some(r => r.active !== false),
			values: d.results.map(r => ({ value: r.result, active: r.active !== false })),
		}))
		.sort((a, b) => b.kept - a.kept); // kept groups first

	const keptCount  = groups.filter(g => g.kept).length;
	const hasDropped = keptCount < groups.length;

	const groupsHtml = groups.map((group, i) => {
		const sep = (hasDropped && i === keptCount)
			? `<span class="stonetop-dice-separator">|</span>`
			: "";
		const diceHtml = group.values.map(({ value }) =>
			`<span class="stonetop-die${group.kept ? "" : " stonetop-die--dropped"}">${value}</span>`
		).join("");
		return `${sep}<span class="stonetop-dice-group">${diceHtml}</span>`;
	}).join("");

	const modeHtml = rollMode === "adv"
		? `<span class="stonetop-roll-mode stonetop-roll-mode--adv">ADV</span>`
		: rollMode === "dis"
		? `<span class="stonetop-roll-mode stonetop-roll-mode--dis">DIS</span>`
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
