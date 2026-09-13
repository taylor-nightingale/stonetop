// Single pipeline for rendering game text (markdown stored): bold/italic via markdown,
// bare dice -> Foundry inline rolls, plus @UUID links - all through Foundry's enrichHTML.
import { markdownBlocks, joinBlocks } from "./markdownBlocks.js";

const DIE       = "\\d*d\\d+(?:\\s*[+-]\\s*\\d+)?";
// A protected Foundry token: an inline roll [[...]] or a @Doc[...]{...} content link.
const TOKEN     = "\\[\\[[^\\]]*\\]\\]|@\\w+\\[[^\\]]*\\](?:\\{[^}]*\\})?";
const AUTO_DICE = new RegExp(`${TOKEN}|(\\b${DIE}\\b)`, "gi");
const TOKEN_RE  = new RegExp(TOKEN, "g");
// Private-use sentinel: cannot appear in real prose and is untouched by the markdown pass.
const SENTINEL  = /\uf8ff(\d+)\uf8ff/g;
// A block-level tag says the value has been through a ProseMirror editor, whose serializer always
// emits one. Block-level specifically, not any tag: markdown routinely contains an inline <em> or a
// <br> that an author typed, and that text still wants the markdown pass.
const BLOCK_HTML = /<(p|div|ul|ol|li|h[1-6]|blockquote|table|pre|section|figure)\b/i;

/** Wrap bare dice (d6, d10+2, 2d6) as `[[/r ...]]`, leaving existing rolls/links untouched. */
export function autoRollDice(text) {
	if (!text) return "";
	return text.replace(AUTO_DICE, (m, die) => (die ? `[[/r ${die}]]` : m));
}

/**
 * Markdown -> HTML, one entry per blank-line-separated block. Callers that give blocks their own
 * wrapper (the ProseMirror seed and its <p>) need them apart; {@link toRollableMarkup} joins them.
 *
 * With `autoRoll` (default), bare dice become inline rolls; pass `{ autoRoll: false }` for prose,
 * where "d6" should stay text. Foundry tokens ([[...]], @Doc[...]) are always shielded from the
 * markdown pass (which would mangle their [ / ]).
 */
export function toRollableBlocks(raw, { autoRoll = true } = {}) {
	if (!raw) return [];
	// Already HTML — leave the markup alone.
	//
	// Game text is stored in one of two forms, and legitimately so: a field edited in an <input> or a
	// <textarea> holds markdown, and a field edited in a <prose-mirror> holds the HTML that editor
	// reads and writes. Running the markdown pass over the second kind mangles it — an underscore in
	// an attribute becomes emphasis, a hyphen at the start of a line becomes a list item.
	//
	// The dice pass still runs: promoting `d6` to an inline roll is a rewrite of the text's content,
	// not of its markup, and creature stat lines need it in both forms.
	const base = autoRoll ? autoRollDice(raw) : raw;
	if (BLOCK_HTML.test(raw)) return [base];
	const tokens = [];
	const shielded = base.replace(TOKEN_RE, m => `\uf8ff${tokens.push(m) - 1}\uf8ff`);
	return markdownBlocks(shielded).map(html => html.replace(SENTINEL, (_, i) => tokens[Number(i)]));
}

/** The same markup as one string: blocks joined for display, authored line breaks intact. */
export function toRollableMarkup(raw, { autoRoll = true } = {}) {
	return joinBlocks(toRollableBlocks(raw, { autoRoll }));
}

// Cross-render memo cache. The followers tab re-runs ~6 enrichGameText calls per follower on every
// re-render (each tag/item edit, each tab switch), and enrichHTML is the dominant cost. The same
// prose enriches identically across renders, so cache it. Only cache text with NO `@` reference,
// since that output can depend on `rollData` (e.g. "@str"); literal-dice prose does not. Bounded.
const _enrichCache = new Map();
const _ENRICH_CACHE_MAX = 1000;

export function clearEnrichCache() { _enrichCache.clear(); }

/** Full pipeline: markdown + inline dice + @UUID links, via Foundry's enrichHTML (async). */
export async function enrichGameText(raw, { rollData = {}, autoRoll = true } = {}) {
	if (!raw) return "";
	const cacheable = !raw.includes("@");
	const key = `${autoRoll}|${raw}`;
	if (cacheable && _enrichCache.has(key)) return _enrichCache.get(key);
	const html = toRollableMarkup(raw, { autoRoll });
	const out  = await foundry.applications.ux.TextEditor.implementation.enrichHTML(html, { async: true, rollData });
	if (cacheable) {
		if (_enrichCache.size >= _ENRICH_CACHE_MAX) _enrichCache.clear();
		_enrichCache.set(key, out);
	}
	return out;
}
