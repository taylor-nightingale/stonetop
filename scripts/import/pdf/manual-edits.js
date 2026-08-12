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
	// bugs.md 14/14b/15 — the Barrier Pass "Commonly available" trade tables. These are bespoke:
	// leading ◇ glyphs are an item-WEIGHT gutter column (Mancatcher/Shield = ◇◇), "Goods" has a
	// "Fine wool" sub-group with indented forms, and each "Livestock" row is a multi-line creature
	// stat block + a value. The heuristic parser drops the weight diamonds, leaves Goods as <p>
	// paragraphs, and captures only the first Livestock row (the rest spill out). Rather than chase
	// fragile heuristics for "stat block inside a value table", hand-author the three tables. Finds are
	// anchored on unique text so a parser change that alters this output is reported as a miss.
	"barrier-pass": [
		{
			find: /<table><thead><tr><th>Arms and armor<\/th>[\s\S]*?<\/table>/,
			replace: "<table><thead><tr><th>Arms and armor</th><th>Value</th></tr></thead><tbody>"
				+ "<tr><td>◇ Cudgel, bronze (<em>close</em>)</td><td>0</td></tr>"
				+ "<tr><td>Bola (<em>thrown</em>, <em>grabby</em>, <em>awkward</em>, -1 die size)</td><td>0</td></tr>"
				+ "<tr><td>◇ Mace or flail, bronze (<em>close</em>, <em>forceful</em>)</td><td>1</td></tr>"
				+ "<tr><td>◇◇ Mancatcher (<em>reach</em>, <em>grabby</em>, -1 die size)</td><td>1</td></tr>"
				+ "<tr><td>◇◇ Shield, bronze (<em>clumsy</em>, +1 Armor, +1 Readiness on a 7+ to Defend)</td><td>1</td></tr>"
				+ "</tbody></table>",
			note: "bugs.md 14: arms-and-armor table — restore the dropped ◇ weight column",
		},
		{
			find: /<p>goods value<\/p>[\s\S]*?outside the Whitefangs<\/p>/,
			replace: "<table><thead><tr><th>Goods</th><th>Value</th></tr></thead><tbody>"
				+ "<tr><td>Fine wool:</td><td></td></tr>"
				+ "<tr><td>garment</td><td>0*</td></tr>"
				+ "<tr><td>◇ bolt</td><td>1*</td></tr>"
				+ "<tr><td>cartload (<em>immobile</em>)</td><td>2*</td></tr>"
				+ "<tr><td>Parchment, a few sheets</td><td>1</td></tr>"
				+ "<tr><td>Ink, vial, and quills</td><td>1</td></tr>"
				+ "<tr><td>◇ Empty book, parchment</td><td>1</td></tr>"
				+ "</tbody></table>\n<p>* +1 if sold/traded outside the Whitefangs</p>",
			note: "bugs.md 14b: goods table — merged header + inline values + Fine wool sub-group",
		},
		{
			find: /<table><thead><tr><th>Livestock<\/th>[\s\S]*?care &amp; grooming<\/p>/,
			replace: "<table><thead><tr><th>Livestock</th><th>Value</th></tr></thead><tbody>"
				+ "<tr><td><strong>Whitefang goat</strong> (<em>sure-footed</em>, <em>curious</em>, <em>wooly</em>); <strong>HP</strong> 3; <strong>Damage</strong> d4 (<em>hand</em>); <strong>Instinct</strong> to explore; can butcher for provisions (6 uses); produces fine wool; sickly in warmer climes</td><td>2</td></tr>"
				+ "<tr><td><strong>Sheep</strong> (<em>timid</em>, <em>hardy</em>, <em>wooly</em>); <strong>HP</strong> 3; <strong>Damage</strong> d4 (<em>hand</em>); <strong>Instinct</strong> to follow the herd; can butcher for ◇ provisions (6 uses)</td><td>1</td></tr>"
				+ "<tr><td><strong>Sheep hound</strong>, follower (<em>keen-nosed</em>, <em>herder</em>, <em>fierce</em>); <strong>HP</strong> 6; <strong>Damage</strong> d6 (<em>hand</em>, <em>grabby</em>); <strong>Instinct</strong> to bully, threaten; Cost: care &amp; grooming</td><td>1</td></tr>"
				+ "</tbody></table>",
			note: "bugs.md 15: livestock table — each row is a multi-line creature stat block + value",
		},
		{
			// Anchored on "Robe/shawl" — there are now two <th>Goods</th> tables (the edited Commonly-
			// available one above and this Special-items one). Ivory / Dark ice are sub-group headers;
			// the heuristic merged them into adjacent rows and crammed Dark ice's forms into one cell.
			find: /<table><thead><tr><th>Goods<\/th><th>Value<\/th><\/tr><\/thead><tbody><tr><td>Robe\/shawl[\s\S]*?<\/table>/,
			replace: "<table><thead><tr><th>Goods</th><th>Value</th></tr></thead><tbody>"
				+ "<tr><td>Robe/shawl, fine wool, intricately patterned (<em>warm</em>, <em>beautiful</em>)</td><td>1*</td></tr>"
				+ "<tr><td>Ivory:</td><td></td></tr>"
				+ "<tr><td>a bit of finery</td><td>1</td></tr>"
				+ "<tr><td>◇ a substantial piece</td><td>2</td></tr>"
				+ "<tr><td>a mammoth tusk (<em>immobile</em>)</td><td>3</td></tr>"
				+ "<tr><td>cartload of mammoth tusks</td><td>4</td></tr>"
				+ "<tr><td><strong>Dark ice</strong> (<em>magical</em>, see page 322)</td><td></td></tr>"
				+ "<tr><td>a small piece (<em>magical</em>)</td><td>1</td></tr>"
				+ "<tr><td>◇ a large chunk (<em>magical</em>)</td><td>2</td></tr>"
				+ "<tr><td>with special characteristics</td><td>+1</td></tr>"
				+ "<tr><td>a functional tool or weapon</td><td>+2</td></tr>"
				+ "<tr><td>An object of <strong>black iron</strong> (page 307)</td><td>+2</td></tr>"
				+ "</tbody></table>",
			note: "bugs.md 14b: Special-items goods table — Ivory/Dark-ice sub-groups merged into rows",
		},
		{
			// One bad row: "Weeks of guided study with a monk" (value 2) was merged with the following
			// sub-header "A guide into the mountains, to…" (whose values are on the "…" rows below it).
			find: /<tr><td>Weeks of guided study with a monk[^<]*<\/td><td>2<\/td><\/tr>/,
			replace: "<tr><td>Weeks of guided study with a monk</td><td>2</td></tr>"
				+ "<tr><td>A guide into the mountains, to…</td><td></td></tr>",
			note: "bugs.md 14b: service/favor — split 'Weeks of guided study' from the guide sub-header",
		},
	],
};

// The same treatment for the arcana pack source, keyed by arcanum slug and applied by build-arcana.js
// to every string in the written `system` (front and back alike). Same guideline: parser bugs get
// fixed in the parser — this is for the book's own text, which the parser must reproduce faithfully.
export const ARCANA_EDITS = {
	"cloak-richly-embroidered": [
		{ find: "exquisitly", replace: "exquisitely", note: "book typo in the cloak's front description" },
	],
};

function replaceAll(text, edits) {
	let out = text, applied = [];
	for (const e of edits) {
		const next = e.find instanceof RegExp ? out.replace(e.find, e.replace) : out.split(e.find).join(e.replace);
		if (next !== out) applied.push(e);
		out = next;
	}
	return { text: out, applied };
}

const missedNotes = (edits, applied) => edits.filter((e) => !applied.includes(e)).map((e) => e.note || String(e.find));

/**
 * Apply the manual edits for one article's rendered HTML. Returns `{ html, applied, misses }` where
 * `misses` lists edits whose `find` matched nothing (callers should surface these).
 */
export function applyManualEdits(html, slug) {
	const edits = MANUAL_EDITS[slug] || [];
	const { text, applied } = replaceAll(html, edits);
	return { html: text, applied: applied.length, misses: missedNotes(edits, applied) };
}

/**
 * Apply one arcanum's edits to every string in its `system`, returning a corrected clone plus the
 * `misses` whose `find` matched nothing. An edit may legitimately match in several places (the same
 * wording on front and back), so an edit counts as applied if it hit anywhere.
 */
export function applyArcanaEdits(system, slug) {
	const edits = ARCANA_EDITS[slug] || [];
	if (!edits.length) return { system, misses: [] };
	const hit = new Set();
	const walk = (v) => {
		if (typeof v === "string") { const { text, applied } = replaceAll(v, edits); applied.forEach((e) => hit.add(e)); return text; }
		if (Array.isArray(v)) return v.map(walk);
		if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
		return v;
	};
	return { system: walk(system), misses: missedNotes(edits, [...hit]) };
}
