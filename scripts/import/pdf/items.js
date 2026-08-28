// Parse Book I's two gear value tables — "Common items" (printed pp. 94-95) and "Special items"
// (printed pp. 96-97) — into the rows that build-items.js turns into pack items and that
// build-item-reference.js prints as the reference journal page.
//
// The tables are set as a grid: each column is a section heading ("weapons", "trade goods") paired
// with a "value" heading at that column's right edge, and every row is one item — name and
// parenthetical at the column's left, Value digit under "value". The book's own typography carries
// the rest of the meaning, so it is read off the font rather than a hand-maintained word list, the
// same split tag-glossary.js relies on: the book states the rule itself on p. 94 ("Terms in italic
// typeface are tags… Terms in regular typeface are mechanical").
//
// The load ◇ and resource ○ markers are vector art with no text layer at all, so they arrive from
// `mutool trace` (rules.js) and are spliced into the line at their own x — inline, unlike the prose
// pipeline's leading bullets, because a row's ○ positions are exactly what separates one resource
// label from the next ("○ plenty left, ○ low ammo, ○ all out").

import { loadStext } from "./stext.js";
import { loadMarkers } from "./rules.js";
import { spliceGlyph } from "./load.js";
import { isAvara, isItalic, isFell } from "./fonts.js";
import { TagGlossary } from "../../../src/model/data/TagGlossary.js";

/** One row of a value table, as the book prints it. `weight` is the ◇ count (0 = a "small" item,
 *  which the book marks with no load diamond at all); `resource` mirrors the ○ track. */
export class BookItem {
	constructor(availability, category) {
		this.availability  = availability; // "common" | "special"
		this.category      = category;     // the book's own section heading, verbatim
		this.name          = "";
		this.value         = 0;
		this.footnoted     = false;        // the book's "1*" — see the section's footnote
		this.tagList       = [];
		this.note          = "";
		this.weight        = 0;
		this.resource      = null;         // { max, labels }
		this.armor         = null;         // { base } | { modifier }
		this.statBlock     = "";           // livestock only: "HP 6; Damage d6 (_hand_, _grabby_); …"
	}

	/** Small items (a pocket, pouch or boot) carry no load diamond; everything else costs its ◇. */
	get inventoryColumn() { return this.weight > 0 ? "regular" : "small"; }
}

/** A table section: the book's heading, the column band it occupies, and its footnote (the "*" line
 *  a starred Value refers to). */
export class TableSection {
	constructor(title, band) {
		this.title    = title;
		this.band     = band;              // { left, valueX, right, top }
		this.footnote = "";
		this.items    = [];
	}
}

// The book sets an inline load diamond as a ZapfDingbats glyph rather than the vector art it uses
// for a table row's leading ◇ — the same glyph p. 142's "mark up to 3 ◇" is set in. mutool reports
// its raw code ("4"), so it is translated back here; nothing else in these tables is a dingbat.
const DINGBAT_GLYPH = { "4": "◇" };
const spanText = (s) => (/Dingbat/i.test(s.font) ? [...s.text].map((c) => DINGBAT_GLYPH[c] ?? "").join("") : s.text);

/** A line's text with dingbat glyphs translated and whitespace collapsed. */
export const lineText = (l) => (l.spans ?? []).map(spanText).join("").replace(/\s+/g, " ").trim();

/** Join a run of lines into markdown, wrapping the book's italic runs in _…_ — the same emphasis
 *  creatures.js keeps on a stat block's damage tags, which the follower sheet renders. */
export function statMarkdown(lines) {
	const toks = [];
	for (const [i, l] of lines.entries()) {
		if (i) {
			// The book breaks a word across lines with a hyphen ("econ-" + "omy"); joining on the space
			// we add below would leave it in the middle of the word.
			const last = toks[toks.length - 1];
			const next = (l.spans ?? []).map(spanText).join("").trimStart();
			if (last && /-$/.test(last.text) && /^[a-z]/.test(next)) last.text = last.text.slice(0, -1);
			else if (last) last.text += " ";
		}
		for (const sp of l.spans ?? []) {
			const t = spanText(sp);
			if (!t) continue;
			const it = isItalic(sp.font);
			const last = toks[toks.length - 1];
			if (last && last.it === it) last.text += t; else toks.push({ it, text: t });
		}
	}
	return toks.map((t) => {
		const m = t.text.match(/^(\s*)(.*?)(\s*)$/s);
		return t.it && m[2] ? `${m[1]}_${m[2]}_${m[3]}` : t.text;
	}).join("").replace(/\s+/g, " ").replace(/\s+([;,)])/g, "$1").replace(/\(\s+/g, "(").trim();
}

// Field labels a livestock stat block prints, in the vocabulary creatures.js already uses. A clause
// that starts with none of them is trailing prose — the goat's "butcher for ◇ provisions".
const STAT_FIELDS = [[/^HP\b/i, "hp"], [/^Armor\b/i, "armor"], [/^Damage\b/i, "damage"],
                     [/^Instinct\b/i, "instinct"], [/^Special qualit\w*/i, "specialQuality"], [/^Cost\b/i, "cost"]];

/**
 * Split a livestock stat block into the creature shape `creatures.js` builds follower docs from
 * (same keys as its `parseStatBlock`), so toFollowerDoc can consume it unchanged.
 *
 * The book sets these inline rather than as Book II's multi-line stat block — one clause per
 * semicolon, each either a labelled field or the trailing prose that becomes a special quality.
 */
export function parseStatBlock(statBlock, { name = "", tagList = [], tagOptions = [] } = {}) {
	const creature = { name, tagList, tagOptions, hp: { value: 0, max: 0 }, armor: "", damage: "",
	                   specialQuality: "", instinct: "", cost: "", moves: [], description: "" };
	const prose = [];
	for (const clause of statBlock.split(";").map((c) => c.trim()).filter(Boolean)) {
		const hit = STAT_FIELDS.find(([re]) => re.test(clause));
		if (!hit) { prose.push(clause); continue; }
		const value = clause.replace(hit[0], "").replace(/^[:\s]+/, "").trim();
		if (hit[1] === "hp") { const n = parseInt(value, 10); if (!Number.isNaN(n)) creature.hp = { value: n, max: n }; }
		else creature[hit[1]] = value;
	}
	if (prose.length) creature.specialQuality = [creature.specialQuality, ...prose].filter(Boolean).join("; ");
	return creature;
}

const VALUE_HEAD = /^value$/i;
const VALUE_CELL = /^\s*(\d)\s*(\*?)\s*$/;
const headFont   = (l) => l.spans?.[0]?.font ?? l.font ?? "";

/**
 * The section columns on a table page: every Fell-type heading paired with the "value" heading set
 * on the same rule to its right. The pairing is what defines the column band, so nothing here has to
 * know the book's page geometry — a reprint that moves the columns still resolves.
 */
export function tableSections(page) {
	const heads  = page.lines.filter((l) => isFell(headFont(l)));
	const values = heads.filter((h) => VALUE_HEAD.test(h.text.trim()));
	const titles = heads.filter((h) => !VALUE_HEAD.test(h.text.trim()));

	const sections = titles.map((t) => {
		const v = values.find((v) => Math.abs(v.bbox[1] - t.bbox[1]) <= 4 && v.bbox[0] > t.bbox[2]);
		if (!v) return null;
		return new TableSection(t.text.trim(), { left: t.bbox[0], valueX: v.bbox[0], right: v.bbox[2], top: t.bbox[1] });
	}).filter(Boolean);

	// A column may stack several sections; each one ends where the next in the SAME column starts.
	for (const s of sections) {
		const below = sections
			.filter((o) => o !== s && Math.abs(o.band.left - s.band.left) < 8 && o.band.top > s.band.top)
			.sort((a, b) => a.band.top - b.band.top)[0];
		s.band.bottom = below ? below.band.top : Infinity;
	}
	return sections.sort((a, b) => a.band.left - b.band.left || a.band.top - b.band.top);
}

/** The body lines of one section, in reading order. */
export function sectionLines(page, section) {
	const { left, right, top, bottom } = section.band;
	return page.lines
		.filter((l) => l.text.trim() && !isAvara(headFont(l))     // skip the folio + running footer
			&& l.bbox[0] >= left - 8 && l.bbox[0] <= right + 4
			&& l.bbox[1] > top + 4 && l.bbox[1] < bottom - 4)
		.sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);
}

/**
 * Group a section's lines into visual rows. The book sets a row's Value digit up to 3pt off its
 * name's baseline and breaks a long name across lines at ~9pt, so lines within 5pt of the row's top
 * belong to it and anything further down starts the next.
 */
export function rowClusters(lines) {
	const rows = [];
	let top = -Infinity;
	for (const l of lines) {
		if (l.bbox[1] - top > 5) { rows.push([]); top = l.bbox[1]; }
		rows[rows.length - 1].push(l);
	}
	// mutool can emit two cells of one visual row a fraction of a point apart vertically, which a
	// y-sort then puts in the wrong order — within a row, reading order is left-to-right.
	return rows.map((r) => r.sort((a, b) => a.bbox[0] - b.bbox[0]));
}

/** Per-character text of a run of lines, each char tagged with the font role it was set in. Wrapped
 *  lines are joined with a space and hyphenated breaks healed, exactly as the prose pipeline does. */
function chars(lines) {
	const out = [];
	for (const l of lines) {
		if (out.length) {
			if (out[out.length - 1].c === "-") out.pop();          // de-hyphenate a split word
			else if (out[out.length - 1].c !== " ") out.push({ c: " ", italic: false });
		}
		for (const s of l.spans ?? []) {
			for (const c of spanText(s)) {
				if (c === " " && out.length && out[out.length - 1].c === " ") continue;
				out.push({ c, italic: isItalic(s.font) });
			}
		}
	}
	while (out.length && out[0].c === " ") out.shift();
	while (out.length && out[out.length - 1].c === " ") out.pop();
	return out;
}

const text = (cs) => cs.map((x) => x.c).join("");

/** Split a parenthetical into comma-separated segments, ignoring commas nested in inner parens. */
function segments(cs) {
	const segs = [];
	let cur = [], depth = 0;
	for (const ch of cs) {
		if (ch.c === "(") depth++;
		if (ch.c === ")") depth--;
		if (ch.c === "," && depth === 0) { segs.push(cur); cur = []; continue; }
		cur.push(ch);
	}
	if (cur.length) segs.push(cur);
	return segs.map((s) => {
		while (s.length && s[0].c === " ") s.shift();
		while (s.length && s[s.length - 1].c === " ") s.pop();
		return s;
	}).filter((s) => s.length);
}

/** Pull the ○ resource track out of a parenthetical: one slot per circle, each labelled with the
 *  text that follows it up to the next circle or the end of its comma segment ("○ plenty left, ○ low
 *  ammo, ○ all out" → three labels; "○○○ hours" → two blanks and "hours"). */
function takeResource(segs) {
	const labels = [];
	const kept = [];
	for (const seg of segs) {
		if (!seg.some((ch) => ch.c === "○")) { kept.push(seg); continue; }
		let before = [], run = null;
		for (const ch of seg) {
			if (ch.c === "○") { if (run) labels.push(text(run).trim()); run = []; continue; }
			if (run) run.push(ch); else before.push(ch);
		}
		if (run) labels.push(text(run).trim());
		const rest = text(before).replace(/[;,\s]+$/, "").trim();
		if (rest) kept.push(before);
	}
	return { resource: labels.length ? { max: labels.length, title: null, labels } : null, kept };
}

const ARMOR = /^([+-]?\d+)\s+armor$/;

/** Turn one clustered row into a BookItem, or null when the lines are a footnote/stray.
 *
 *  `knownTags` corroborates the typeface split. The book states the italic rule on p. 94 and then
 *  breaks it in a handful of rows — "Cloak (warm)" and "Mallet, iron or wood (hand)" are set roman
 *  where "Blanket (warm)" is italic — so a segment that IS a glossary tag is read as one whatever
 *  face it was set in. Only the book's own glossary counts, never a guess at what looks tag-ish. */
export function parseRow(rowLines, section, availability, knownTags = new Set()) {
	const valueLine = rowLines.find((l) => l.bbox[0] >= section.band.valueX - 8 && VALUE_CELL.test(l.text));
	if (!valueLine) return null;
	const [, digit, star] = valueLine.text.match(VALUE_CELL);

	const body = rowLines.filter((l) => l !== valueLine);
	const item = new BookItem(availability, section.title);
	item.value     = Number(digit);
	item.footnoted = star === "*";

	let cs = chars(body);
	while (cs.length && (cs[0].c === "◇" || cs[0].c === " ")) { if (cs[0].c === "◇") item.weight++; cs.shift(); }

	// A livestock row carries a follower stat block on its wrapped lines; keep those verbatim and
	// parse only the creature's own name/tag line.
	const statAt = body.findIndex((l) => /^\s*(HP\b|Instinct\b|Cost\b)/.test(l.text.trim()));
	if (statAt > 0) {
		item.statBlock = statMarkdown(body.slice(statAt));
		cs = chars(body.slice(0, statAt));
		while (cs.length && (cs[0].c === "◇" || cs[0].c === " ")) { if (cs[0].c === "◇") item.weight++; cs.shift(); }
	}

	const open = cs.findIndex((ch) => ch.c === "(");
	const nameCs = open === -1 ? cs : cs.slice(0, open);
	item.name = text(nameCs).replace(/[.,\s]+$/, "").trim();

	if (open !== -1) {
		// Cut at the LAST ")" — the book sometimes sets punctuation outside it ("…, area).").
		const close = cs.map((ch) => ch.c).lastIndexOf(")");
		const inner = cs.slice(open + 1, close === -1 ? cs.length : close);
		const { resource, kept } = takeResource(segments(inner));
		item.resource = resource;
		const notes = [];
		for (const seg of kept) {
			const t = text(seg).trim();
			if (!t) continue;
			if (seg.every((ch) => ch.italic || ch.c === " ") || knownTags.has(t.toLowerCase())) item.tagList.push(t);
			else notes.push(t.replace(/[;\s]+$/, ""));
		}
		item.note = notes.join(", ").replace(/[;,\s]+$/, "");
		const armor = notes.map((n) => n.match(ARMOR)).find(Boolean);
		if (armor) item.armor = armor[1].startsWith("+") ? { modifier: Number(armor[1]) } : { base: Number(armor[1]) };
	}
	return item.name ? item : null;
}

/** Splice each vector marker into the table line it sits on, at its own x. Table rows want every
 *  glyph INLINE (a row's ○ order is what separates its resource labels), so a leading ◇ is prepended
 *  rather than pushed as the separate pseudo-line the prose pipeline uses.
 *
 *  A marker sits BETWEEN two baselines, so the nearest vertical centre wins — picking the leftmost
 *  candidate instead would hand a wrapped row's diamond to the flush row above it. */
export function attachTableMarkers(page, markers) {
	const mid = (l) => (l.bbox[1] + l.bbox[3]) / 2;
	for (const mk of markers) {
		const g = mk.kind === "circle" ? "○" : mk.kind === "diamond" ? "◇" : null;
		if (!g) continue;
		const cy = mk.y - mk.h / 2;
		const cand = page.lines.filter((l) => l.text.trim() && !isFell(headFont(l)) && !VALUE_CELL.test(l.text)
			&& l.bbox[1] - 3 <= cy && l.bbox[3] + 3 >= cy
			// A trailing glyph sits just past the last character's advance, so the span test allows a
			// little overshoot ("One silver coin is roughly worth a ◇" ends its line with one).
			&& (l.bbox[0] >= mk.x - 3 ? l.bbox[0] < mk.x + 60 : mk.x <= l.bbox[2] + 8));
		// Nearest baseline first, then nearest horizontally: a row set in two mutool cells ("◇ Oil
		// lamp (" + "○○○ hours, close,") puts both on the same line, and only the x tie-break keeps
		// the leading diamond off the second one.
		const line = cand.sort((a, b) =>
			Math.abs(mid(a) - cy) - Math.abs(mid(b) - cy) || Math.abs(a.bbox[0] - mk.x) - Math.abs(b.bbox[0] - mk.x))[0];
		if (!line) continue;
		if (spliceGlyph(line, mk.x, g)) continue;
		// No character sits at or right of the marker: it either leads the line or trails it.
		if (mk.x <= line.bbox[0]) {
			const first = line.spans[0];
			first.text = g + first.text;
			first.xs?.unshift(mk.x);
		} else {
			const last = line.spans[line.spans.length - 1];
			last.text += g;
			last.xs?.push(mk.x);
		}
		line.text = line.spans.map((s) => s.text).join("");
	}
	return page;
}

/** Every item the given table page prints, section by section.
 *
 *  A row wraps onto as many lines as its text needs, and only its FIRST carries the Value digit — so
 *  a cluster with no value cell is a continuation and folds into the row above it. */
export function parseItemPage(page, availability, knownTags = new Set()) {
	const sections = tableSections(page);
	for (const section of sections) {
		const rows = [];
		for (const cluster of rowClusters(sectionLines(page, section))) {
			if (cluster.every((l) => /^\s*\*/.test(l.text))) { section.footnote = cluster.map((l) => l.text.trim()).join(" "); continue; }
			const starts = cluster.some((l) => l.bbox[0] >= section.band.valueX - 8 && VALUE_CELL.test(l.text));
			if (starts || !rows.length) rows.push(cluster);
			else rows[rows.length - 1].push(...cluster);
		}
		for (const row of rows) {
			const item = parseRow(row, section, availability, knownTags);
			if (item) section.items.push(item);
		}
	}
	return sections;
}

/** The tag tokens Book I defines, read off the language file the tag-glossary build writes. */
export function knownTagSlugs(en) {
	return new Set(TagGlossary.fromTranslations(en?.stonetop?.tagGlossary ?? {}).bySlug.keys());
}

/**
 * The book's own lead-in for a table page — the paragraph it sets under the title, above the first
 * section ("The following are commonly available, mundane items…"). Read from the title's column so
 * a spread carrying two tables keeps each lead with its own.
 */
export function tableLead(page, sections) {
	// A spread sets a facing sidebar in the same display face, so the title is the one standing over
	// a column this table actually occupies — not simply the biggest Avara line on the page.
	const inColumn = (l) => sections.some((s) => Math.abs(s.band.left - l.bbox[0]) < 8);
	const title = page.lines.filter((l) => isAvara(headFont(l)) && l.size >= 11 && inColumn(l))
		.sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0])[0];
	if (!title) return "";
	const left = title.bbox[0];
	const own = sections.filter((s) => Math.abs(s.band.left - left) < 8);
	const firstHead = Math.min(...own.map((s) => s.band.top));
	// Bound the lead by the column's own right edge — the next column starts exactly one column-width
	// over, so a width-based window would swallow its first rows.
	const right = Math.max(...own.map((s) => s.band.right));
	const lines = page.lines
		.filter((l) => l.text.trim() && !isAvara(headFont(l)) && !isFell(headFont(l))
			&& l.bbox[0] >= left - 4 && l.bbox[0] <= right + 4
			&& l.bbox[1] > title.bbox[1] + 4 && l.bbox[1] < firstHead - 4)
		.sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);
	return statMarkdown(lines);
}

/** The one page in `window` whose text carries `anchor`. Throws rather than guessing, so a reprint
 *  that moves the tables fails loudly instead of building a partial pack. */
export function findTablePage(pdf, { name, window, anchor }) {
	const pages = loadStext(pdf, window);
	const hit = pages.findIndex((p) => p.lines.some((l) => anchor.test(l.text.trim())));
	if (hit === -1) throw new Error(`${name}: no page in ${window} of ${pdf} matches ${anchor}`);
	return { page: pages[hit], pdfPage: Number(window.split("-")[0]) + hit };
}

// Page windows rather than exact pages, for the same reason build-tag-glossary.js uses them.
export const TABLES = [
	{ name: "Common items",  availability: "common",  window: "40-60", anchor: /^common items$/i },
	{ name: "Special items", availability: "special", window: "40-60", anchor: /^special items$/i },
];

/** Load both value tables from Book I: stext + spliced vector markers, parsed into sections. */
export function parseItemTables(pdf, knownTags = new Set()) {
	return TABLES.map((t) => {
		const { page, pdfPage } = findTablePage(pdf, t);
		attachTableMarkers(page, loadMarkers(pdf, pdfPage));
		const sections = parseItemPage(page, t.availability, knownTags);
		if (!sections.length) throw new Error(`${t.name}: page matched but no sections parsed`);
		return { ...t, pdfPage, sections, lead: tableLead(page, sections) };
	});
}

// ── The Inventory insert (printed p. 142) ─────────────────────────────────────
//
// The insert is the printed character sheet's gear checklist, and it — not the value tables — is what
// `packs/outfit-items` holds: the fixed list of rows every sheet renders. The value tables price the
// whole world's goods (pp. 92-97); only the subset the insert prints is an item a character carries.
//
// A row is identified by its MARK, not by its text: the book gives every markable row a leading ◇ (a
// load item) or □ (a small item) in the vector layer, and gives prose none. Reading the mark is what
// separates "Blanket (warm)" from "For a light load (quick & quiet), mark up to 3 ◇" without a
// hand-maintained list of the sentences to ignore.

/** Printed p. 142. The insert shares its spread with the Ranger's Animal Companion sheet, so
 *  everything here is bounded to the left page. */
export const INSERT = { name: "Inventory insert", window: "68-76", anchor: /^inventory for/i };

// A checklist column's marks all sit at one x, and enough rows hang off it to tell that gutter from
// the loose ○ pips a row sets inline ("Oil lamp (○○ hours…)"), which never line up with anything.
// Derived from the page rather than hard-coded, so a reprint that moves the columns still parses.
const GUTTER_ROWS = 4;
const MARK_GAP    = 10;   // a row's text starts within this of its own gutter mark

/**
 * The item names the Inventory insert prints, in printed order.
 *
 * Names come back exactly as the book sets them, minus the parenthetical — "Rope, ~25 ft", not
 * "Rope". `INSERT_ALIASES` is what pairs them with the value tables' own wording for the same
 * object; nothing here tries to reconcile the two lists. The insert's blank write-in rows carry a
 * mark and no text, so they fall out on their own.
 */
export function parseInsertItems(pdf) {
	return parseInsertLines(pdf).flat().map((r) => r.name);
}

/** Printed p. 142's marked rows, grouped into the printed lines they share — the page's own layout.
 *  See insertItemLines for what a line means. */
export function parseInsertLines(pdf) {
	const { page, pdfPage } = findTablePage(pdf, INSERT);
	const lines = insertItemLines(page, loadMarkers(pdf, pdfPage));
	if (!lines.length) throw new Error(`${INSERT.name}: page ${pdfPage} matched but no marked rows parsed`);
	return lines;
}

/** One marked row of the insert: the item's name as printed, and which checklist it stands in — a
 *  load ◇ puts it in the regular column, the □/○ of a pocket item in the small one. The book itself
 *  says which, in the vector layer, so nothing here has to be told. */
export class InsertRow {
	constructor(name, column) {
		this.name   = name;      // as printed, parenthetical removed
		this.column = column;    // "regular" | "small"
	}
}

/**
 * The insert's marked rows, grouped into the printed LINES they share, in reading order.
 *
 * A line holding two rows of the same column is a pair the book sets two-across ("Blanket | Change
 * of clothes"), which is how the page's layout is read off the book rather than kept by hand.
 */
export function insertItemLines(page, markers) {
	const midpoint = page.width / 2;
	const marks = gutterMarks(markers.filter((m) => m.x < midpoint));
	const lines = page.lines
		.filter((l) => l.bbox[2] <= midpoint && l.text.trim() && leadingMark(l, marks))
		.sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);
	return clusterRows(lines)
		.map((row) => row
			.map((l) => new InsertRow(insertItemName(l.text), columnOf(leadingMark(l, marks))))
			.filter((r) => r.name))
		.filter((row) => row.length);
}

/** The marked rows of the insert page, in printed order. Pure over a parsed page and its markers. */
export function insertItemNames(page, markers) {
	return insertItemLines(page, markers).flat().map((r) => r.name);
}

/** A load ◇ is the regular column; the □ (or ○, depending how the book drew it) is a small item. */
const columnOf = (mark) => (mark?.kind === "diamond" ? "regular" : "small");

// Two rows set side by side do not always share an exact baseline — "Little box" sits a point below
// the "Sack" beside it, "Tallow" a point above the "Sawdust" — so ordering by y alone reads those
// pairs backwards. A row is a cluster of baselines within ROW_TOLERANCE, well under the ~9pt the
// insert sets its lines at. Clustering measures from the row's FIRST line, not the previous one, so
// a long run of near-baselines cannot chain the whole column into a single row.
const ROW_TOLERANCE = 4;

/** Lines clustered into the printed rows they share, top to bottom, each row read left to right. */
function clusterRows(lines) {
	const rows = [];
	for (const line of lines) {
		const row = rows.at(-1);
		if (row && line.bbox[1] - row[0].bbox[1] <= ROW_TOLERANCE) row.push(line);
		else rows.push([line]);
	}
	for (const row of rows) row.sort((a, b) => a.bbox[0] - b.bbox[0]);
	return rows;
}

/** Only the marks standing in a checklist gutter — a column x that at least GUTTER_ROWS rows share. */
function gutterMarks(marks) {
	const counts = new Map();
	for (const m of marks) counts.set(Math.round(m.x), (counts.get(Math.round(m.x)) ?? 0) + 1);
	return marks.filter((m) => counts.get(Math.round(m.x)) >= GUTTER_ROWS);
}

/** The gutter mark this line hangs off, or null — which is how prose, a wrapped continuation
 *  ("hours, close, area, crude)") and a heading are all excluded without naming any of them. */
function leadingMark(line, marks) {
	const [x0, y0, , y1] = line.bbox;
	return marks.find((m) => m.y >= y0 && m.y <= y1 && m.x < x0 && x0 - m.x <= MARK_GAP) ?? null;
}

/** A row's item name: what the book sets before the parenthetical. */
function insertItemName(text) {
	return text.split("(")[0].replace(/\s+/g, " ").trim().replace(/[,\s]+$/, "");
}
