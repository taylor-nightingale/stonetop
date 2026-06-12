// Single pipeline for rendering game text (markdown stored): bold/italic via markdown,
// bare dice -> Foundry inline rolls, plus @UUID links - all through Foundry's enrichHTML.
// See helper/text-rendering.md.
import snarkdown from "../../lib/snarkdown.es.js";

const DIE       = "\\d*d\\d+(?:\\s*[+-]\\s*\\d+)?";
// A protected Foundry token: an inline roll [[...]] or a @Doc[...]{...} content link.
const TOKEN     = "\\[\\[[^\\]]*\\]\\]|@\\w+\\[[^\\]]*\\](?:\\{[^}]*\\})?";
const AUTO_DICE = new RegExp(`${TOKEN}|(\\b${DIE}\\b)`, "gi");
const TOKEN_RE  = new RegExp(TOKEN, "g");
// Private-use sentinel: cannot appear in real prose and is untouched by the markdown pass.
const SENTINEL  = /\uf8ff(\d+)\uf8ff/g;

/** Wrap bare dice (d6, d10+2, 2d6) as `[[/r ...]]`, leaving existing rolls/links untouched. */
export function autoRollDice(text) {
	if (!text) return "";
	return text.replace(AUTO_DICE, (m, die) => (die ? `[[/r ${die}]]` : m));
}

/**
 * Markdown -> HTML with bare dice turned into inline rolls. Foundry tokens ([[...]],
 * @Doc[...]) are shielded from the markdown pass (which would mangle their [ / ]).
 */
export function toRollableMarkup(raw) {
	if (!raw) return "";
	const tokens = [];
	const shielded = autoRollDice(raw).replace(TOKEN_RE, m => `\uf8ff${tokens.push(m) - 1}\uf8ff`);
	return snarkdown(shielded).replace(SENTINEL, (_, i) => tokens[Number(i)]);
}

/** Full pipeline: markdown + inline dice + @UUID links, via Foundry's enrichHTML (async). */
export async function enrichGameText(raw, { rollData = {} } = {}) {
	if (!raw) return "";
	const html = toRollableMarkup(raw);
	return foundry.applications.ux.TextEditor.implementation.enrichHTML(html, { async: true, rollData });
}
