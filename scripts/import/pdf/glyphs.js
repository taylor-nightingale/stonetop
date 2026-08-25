// The books set a few marks as font glyphs rather than as text or vector art: the load diamond a
// sentence carries inline ("A ◇ sack of seeds", "butcher for ◇ provisions"), and the check boxes on
// an arcanum's tracks. mutool reports the raw code the glyph is encoded at — "4" for the diamond —
// so a renderer that passes the span through prints a bare digit, and one that drops the span loses
// the mark entirely. Both are wrong; this translates.
//
// Two dingbat faces carry the same marks — Book I sets them in ZapfDingbats, Book II in
// ITCDINGMedium — so the test covers both rather than the one name `fonts.js isDingbat` was written
// for (which matched Zapf only, and silently let Book II's raw "4" through).

/** A face whose "text" is glyph codes, not characters. */
export const isGlyphFont = (font) => /Dingbat|ITCDING/i.test(String(font ?? ""));

// Glyph code → the character it draws. Anything unmapped is dropped: an unrecognised dingbat is
// decoration, and printing its code would be worse than printing nothing.
//
// "4" is the MARKED load diamond — the one the book draws with a tick inside it. That is the whole
// reason it is a font glyph: an UNMARKED ◇ is vector art (rules.js parseMarkers), so the two are
// encoded differently and the split is what tells them apart. Compare, on the same spread, "then
// bring ◇ supplies" (vector, empty — you have yet to mark it) with "up to 3 ◆, then you have a light
// load" and "you marked ◆ supplies, a ◆ shovel" (glyph, marked).
//
// Rendered filled rather than ticked, because that is what a checked load slot already looks like on
// the character sheet (.stonetop-inv-diamond.is-checked fills with currentColor) — one meaning, one
// appearance, wherever it is drawn.
export const GLYPH_CHARS = {
	"4": "◆",
};

/** A span's text with glyph codes translated; "" for a glyph span carrying nothing we render. */
export function glyphText(span) {
	if (!isGlyphFont(span?.font)) return span?.text ?? "";
	return [...(span.text ?? "")].map((c) => GLYPH_CHARS[c] ?? "").join("");
}
