/** Capitalize the first character of a string. */
export function capitalizeFirst(str) {
	return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

/** Lowercase kebab-case slug: non-alphanumerics collapse to dashes, edges trimmed. */
export function slugify(name) {
	return String(name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Escape a value for safe insertion into HTML. */
export function escHtml(v) {
	return foundry.utils.escapeHTML(String(v ?? ""));
}

/** Ensure miss result labels are visually emphasized in rendered move text. */
export function boldMissText(html) {
	return String(html ?? "").replace(/(<strong>\s*)?\b(on a 6(?:-|\u2212|\u00e2\u02c6\u2019))(\s*<\/strong>)?/gi, (match, open, label, close) => {
		if (open && close) return match;
		return `<strong>${label}</strong>`;
	});
}

/**
 * Strip "... +STAT to ..." option lines from a move description that don't
 * match the chosen stat, for "ask"-type moves (Defy Danger, Interfere) where
 * the player picks one stat from a list of several presented in the text.
 */
export function filterStatOptionLines(html, statKey) {
	if (!statKey) return String(html ?? "");
	const want = String(statKey).toUpperCase();
	return String(html ?? "").replace(/<p>\s*\.\.\.\s*\+([A-Z]{3})\b[^<]*<\/p>/g, (match, stat) =>
		stat === want ? match : ""
	);
}

/** Returns true when `img` is the Foundry default actor/token image or absent. */
export function isDefaultImg(img) {
	const defaultToken = globalThis.CONST?.DEFAULT_TOKEN ?? "icons/svg/mystery-man.svg";
	return !img || img === "icons/svg/mystery-man.svg" || img === defaultToken;
}

// Mis-decoded UTF-8 sequences seen in the transcribed playbook text → their real
// glyph. Used to clean playbook option text (instincts, costs, tags, choices)
// wherever it is shown or stored, so the onboarding dialog and the character
// sheet normalise identically.
const _PLAYBOOK_GLYPH_FIXES = [
	[[0xe2, 0x2014, 0x2039], [0x25cb]], // circle
	[[0xe2, 0x2014, 0x2021], [0x25c7]], // diamond
	[[0xe2, 0x2014, 0x2020], [0x25c6]], // filled diamond
	[[0xe2, 0x2013, 0x00a1], [0x25a1]], // square
	[[0x00c2, 0x00b7], [0x00b7]],       // middle dot
	[[0xe2, 0x20ac, 0x201d], [0x2014]], // em dash
	[[0xe2, 0x20ac, 0x201c], [0x2013]], // en dash
	[[0xe2, 0x20ac, 0x00a6], [0x2026]], // ellipsis
	[[0xe2, 0x20ac, 0x2122], [0x2019]], // apostrophe
	[[0xe2, 0x20ac, 0x0153], [0x201c]], // opening quote
	[[0xe2, 0x20ac, 0x009d], [0x201d]], // closing quote
].map(([from, to]) => [String.fromCodePoint(...from), String.fromCodePoint(...to)]);

/** Repair mis-decoded glyphs in transcribed playbook text. */
export function normalizePlaybookGlyphs(value) {
	let text = String(value ?? "");
	for (const [from, to] of _PLAYBOOK_GLYPH_FIXES) text = text.replaceAll(from, to);
	return text;
}

// ── Instinct format ─────────────────────────────────────────────────────────
// A character's instinct reads "Word — Description" (e.g. "Delight — To find
// beauty…"). Custom instincts follow the same shape so they sit alongside the
// playbook's suggestions. These compose / split the two halves around the
// shared space-em-dash-space separator.

export const INSTINCT_SEPARATOR = " — ";

/** Reduce a custom instinct's word to a single token (an instinct is one word). */
function oneWord(value) {
	return String(value ?? "").trim().split(/\s+/)[0] ?? "";
}

/**
 * Compose a "Word — Description" instinct value from its two halves. The
 * separator is kept whenever there's a description (even with an empty word) so
 * the value round-trips through {@link parseInstinct} losslessly: a
 * description-only instinct stays a description and never collapses into the word
 * half. A word with no description has no separator.
 */
export function composeInstinct(word, description) {
	const w = oneWord(word);
	const d = String(description ?? "").trim();
	if (!w && !d) return "";
	if (!d) return w;
	return `${w}${INSTINCT_SEPARATOR}${d}`;
}

/** Split a stored instinct value back into { word, description }. */
export function parseInstinct(value) {
	const v = String(value ?? "").trim();
	if (!v) return { word: "", description: "" };
	const idx = v.indexOf(INSTINCT_SEPARATOR);
	if (idx === -1) return { word: v, description: "" };
	return {
		word:        v.slice(0, idx).trim(),
		description: v.slice(idx + INSTINCT_SEPARATOR.length).trim(),
	};
}
