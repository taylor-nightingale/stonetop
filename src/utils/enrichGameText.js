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
 * Markdown -> HTML. With `autoRoll` (default), bare dice become inline rolls; pass
 * `{ autoRoll: false }` for prose, where "d6" should stay text. Foundry tokens ([[...]],
 * @Doc[...]) are always shielded from the markdown pass (which would mangle their [ / ]).
 */
export function toRollableMarkup(raw, { autoRoll = true } = {}) {
	if (!raw) return "";
	const tokens = [];
	const base = autoRoll ? autoRollDice(raw) : raw;
	const shielded = base.replace(TOKEN_RE, m => `\uf8ff${tokens.push(m) - 1}\uf8ff`);
	return snarkdown(shielded).replace(SENTINEL, (_, i) => tokens[Number(i)]);
}

/**
 * Prose markdown -> HTML for the `{{md}}` helper: renders markdown and preserves any
 * explicit [[ ]] rolls / @UUID links as text (a later enrichHTML pass makes them clickable),
 * but does NOT auto-roll bare dice. Synchronous, so the template renders without flicker.
 */
export function renderMarkdown(raw) {
	return toRollableMarkup(raw, { autoRoll: false });
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

/**
 * Post-render pass: upgrade explicit Foundry tokens ([[ ]] rolls, @UUID links) inside
 * already-rendered `.stonetop-rich` elements into clickable HTML. The markdown was rendered
 * synchronously by the `{{md}}` helper, so this only runs enrichHTML \u2014 and only on elements
 * that actually contain a token, so it's a no-op when there are none.
 */
export async function enrichRichTokens(root, { rollData = {} } = {}) {
	if (!root) return;
	const els = root.querySelectorAll(".stonetop-rich");
	await Promise.all([...els].map(async el => {
		if (el.dataset.tokensEnriched || !/\[\[|@\w+\[/.test(el.innerHTML)) return;
		el.innerHTML = await foundry.applications.ux.TextEditor.implementation
			.enrichHTML(el.innerHTML, { async: true, rollData });
		el.dataset.tokensEnriched = "1";
	}));
}
