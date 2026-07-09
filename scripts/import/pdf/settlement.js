// Parse the book's settlement (steading) stat box — the "Size … / Population / Prosperity / Defenses"
// card the Wider-World place articles print (layout.js emits it as a `settlement` block). Shared by
// render-html.js (renders the box as a bordered card) and build-steadfasts.js (turns the box into a
// steadfast item's starting ratings + resource/fortification lists). Pure over the block's `lines`.

/** The starting ratings a place's settlement box carries, plus the lists that back Prosperity
 *  (resources) and Defenses (fortifications). Size is a tier string; the ±N ratings are numbers. */
export class Settlement {
	constructor() {
		this.size           = "";
		this.population     = 0;
		this.prosperity     = 0;
		this.defenses       = 0;
		this.resources      = [];
		this.fortifications = [];
	}
}

// Segment the block's lines into flush FIELD lines (Size / Population / Prosperity / Resources /
// Defenses, bold at the field column) and indented BULLET items (each a swirl-bulleted line plus its
// wrapped continuations) — the geometry-based split the HTML renderer draws as a card. Returns
// [{ field:[lines] } | { items:[[lines]] }].
export function segmentSettlement(lines) {
	const fieldX = Math.min(...lines.map((l) => l.bbox[0]));
	const segs = [];
	let cur = null;
	for (const l of lines) {
		const hasBullet = /^swirl/.test(l.spans?.[0]?.font || "") || /^ä\s/.test(l.text.trim());
		if (l.bbox[0] <= fieldX + 4 && !hasBullet) segs.push(cur = { field: [l] });            // a field / sub-heading line
		else if (hasBullet || l.bbox[0] <= fieldX + 10) { if (!cur?.items) segs.push(cur = { items: [] }); cur.items.push([l]); } // a bullet item
		else if (cur?.items) cur.items[cur.items.length - 1].push(l);                          // a wrapped bullet line
		else if (cur?.field) cur.field.push(l);                                                // a wrapped field line
		else segs.push(cur = { field: [l] });
	}
	return segs;
}

// The five ratings/list headings that structure the box. Matched on text alone (not font/geometry):
// the book sometimes stamps a rating line with a leading swirl bullet (Gordin's "Prosperity"), so the
// keyword is the only reliable anchor.
const HEADING = /^(?:Size|Population|Prosperity|Resources|Defenses)\b/i;
// A real bullet glyph (swirl dingbat) or a stat-block move marker begins a fresh list entry.
const isBullet = (l) => /^swirl/.test(l.spans?.[0]?.font || "") || /^ä\s/.test(l.text.trim());
// A "… partner (goods)" trade option — its own entry, hung off the preceding "Trade with…" heading.
const isEllipsis = (l) => /^(?:…|\.\.\.)/.test(l.text.trim());
// A wrapped continuation of the entry above: the book only ever breaks a line mid-phrase, so a
// continuation starts lower-case or with punctuation ("tin, silver)"). A new entry starts upper-case.
const isWrap = (l) => /^[a-z(),]/.test(l.text.trim());

// Join a run of lines into one plain-text string: de-hyphenate words split across a line break and
// collapse whitespace. (The HTML renderer's joinLines does the same but emits spans/markup; this is
// the text-only equivalent the steadfast build needs.)
function joinText(lines) {
	let out = "";
	for (const l of lines) {
		const raw = l.text.replace(/\s+/g, " ").trim();
		if (!out) out = raw;
		else if (/[A-Za-z]-$/.test(out) && /^[a-z]/.test(raw)) out = out.slice(0, -1) + raw; // de-hyphenate a split word
		else out += " " + raw;
	}
	return out.replace(/\s{2,}/g, " ").trim();
}

// "+0" → 0, "-1" → -1, "+2" → 2. Book minus signs (en-dash / minus glyph) are normalised to ASCII;
// `|| 0` collapses a parsed -0 to 0.
const num = (s) => { const m = String(s).replace(/[–—−]/g, "-").match(/-?\d+/); return m ? (parseInt(m[0], 10) || 0) : 0; };

// A "Trade with…" lead line is just a heading for the options beneath it — drop it. Each option was
// written as "… partner (goods)"; restore the "Trade with" it hangs off. Anything else is kept as-is.
function normalizeEntry(text) {
	const t = text.trim();
	if (/^Trade with\b.*(?:…|\.\.\.)\s*$/.test(t)) return null;                       // "Trade with…" / "Trade with (pick 1)…" heading
	if (/^(?:…|\.\.\.)/.test(t)) return "Trade with " + t.replace(/^(?:…|\.\.\.)\s*/, "");
	return t || null;
}

/**
 * Parse a settlement block's `lines` into a Settlement: the four ratings (Size tier, Population,
 * Prosperity, Defenses) plus the resource list backing Prosperity and the fortification list backing
 * Defenses. The Prosperity/Resources sub-lists both feed `resources`; the Defenses sub-list feeds
 * `fortifications`. Trade options ("… partner (goods)") are rejoined as "Trade with partner (goods)".
 *
 * Classifies each line by content, not geometry: a HEADING keyword switches the target list; a bullet
 * glyph or "…" option starts a new entry; a lower-case line continues the entry above.
 */
export function parseSettlement(lines) {
	const s = new Settlement();
	let bucket = null; // "resources" | "fortifications" | null — where following entries go
	let entry = null;  // lines of the entry currently being collected
	const flush = () => {
		if (entry) { const e = normalizeEntry(joinText(entry.lines)); if (e) s[entry.bucket].push(e); }
		entry = null;
	};
	for (const l of lines) {
		const t = l.text.trim();
		if (HEADING.test(t)) {
			flush();
			if (/^Size\b/i.test(t))            { s.size = (t.match(/^Size\s+([A-Za-z]+)/i)?.[1] || "").toLowerCase(); bucket = null; }
			else if (/^Population\b/i.test(t)) { s.population = num(t); bucket = null; }
			else if (/^Prosperity\b/i.test(t)) { s.prosperity = num(t); bucket = "resources"; }
			else if (/^Resources\b/i.test(t))  { bucket = "resources"; }
			else if (/^Defenses\b/i.test(t))   { s.defenses = num(t); bucket = "fortifications"; }
			continue;
		}
		if (!bucket) continue; // stray content before the first list heading
		if (!isBullet(l) && !isEllipsis(l) && isWrap(l) && entry) entry.lines.push(l); // continuation
		else { flush(); entry = { bucket, lines: [l] }; }                              // new entry
	}
	flush();
	return s;
}
