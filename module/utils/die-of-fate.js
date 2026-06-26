import { stonetopCardShell, rollFormulaChip } from "./chat.js";

// Stonetop's d6 oracle (weather, the Vellum Scroll's costs, etc.). Results read
// like a traffic light: 1–2 bad, 3–4 mixed, 5–6 good.
const FATE_BANDS = [
	{ key: "bad",   range: "1–2", label: "Bad" },
	{ key: "mixed", range: "3–4", label: "Neutral / mixed" },
	{ key: "good",  range: "5–6", label: "Good" },
];

/** Roll the Die of Fate and post a colour-coded result card to chat. */
export async function rollDieOfFate() {
	const roll = await new Roll("1d6").evaluate();
	const band = FATE_BANDS[Math.ceil(roll.total / 2) - 1]; // 1–2→0, 3–4→1, 5–6→2

	const legend = FATE_BANDS.map(b =>
		`<li class="stonetop-fate-legend-row stonetop-fate--${b.key}${b === band ? " is-active" : ""}"><strong>${b.range}</strong> ${b.label}</li>`
	).join("");

	// No title row — the message's speaker alias already reads "Die of Fate".
	const body = `<div class="card-content stonetop-fate">
		<ul class="stonetop-fate-legend">${legend}</ul>
		${rollFormulaChip(roll.formula)}
		<div class="stonetop-fate-result stonetop-fate--${band.key}">
			<span class="stonetop-fate-number">${roll.total}</span>
			<span class="stonetop-fate-label">${band.label}</span>
		</div>
	</div>`;

	await roll.toMessage({
		speaker: { alias: "Die of Fate" },
		flavor:  stonetopCardShell(body, "stonetop-fate-card"),
	});
}
