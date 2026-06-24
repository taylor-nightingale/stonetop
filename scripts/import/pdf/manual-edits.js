// Build-time, per-article corrections for one-off layout quirks the heuristic parser gets wrong.
// Applied to the rendered HTML in build-journal.js (so the fix is baked into the committed pack
// source and reproduced on every rebuild — NOT a hand-edit of the output, which would be clobbered,
// and NOT a runtime adapter). Each edit is a literal-string or RegExp find/replace keyed by the
// article slug, with a `note` citing the bug it fixes.
//
// Guideline: if a fix generalises across articles, fix the parser (layout.js/render-html.js) instead.
// Use this only for genuine one-offs — a specific article's image placement, a cross-column rejoin,
// a particular line's wording — where a general heuristic would be fragile.
//
// Each entry: { find: string | RegExp, replace: string, note: string }. A RegExp without the `g`
// flag replaces the first match; add `g` for all. A `find` that matches nothing is reported (so an
// edit that silently stops applying — because the parser improved or the text changed — surfaces).

export const MANUAL_EDITS = {
	// "the-village-of-stonetop": [
	//   { find: "…feel</li><…>like home?", replace: "…feel like home?…", note: "bugs.md: rejoin cross-column question" },
	// ],
};

/**
 * Apply the manual edits for one article's rendered HTML. Returns `{ html, applied, misses }` where
 * `misses` lists edits whose `find` matched nothing (callers should surface these).
 */
export function applyManualEdits(html, slug) {
	const edits = MANUAL_EDITS[slug] || [];
	let out = html, applied = 0;
	const misses = [];
	for (const e of edits) {
		const next = e.find instanceof RegExp ? out.replace(e.find, e.replace) : out.split(e.find).join(e.replace);
		if (next === out) misses.push(e.note || String(e.find));
		else applied++;
		out = next;
	}
	return { html: out, applied, misses };
}
