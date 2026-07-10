import { isAvara, isItalic, isDingbat, isFell } from "./fonts.js";

// Extraction only: this module turns a spread's stext lines + vector markers into a structured,
// renderer-agnostic article document (typed blocks). HTML generation lives in render-html.js.

const TITLE_MIN = 16;   // Avara-Bold ≥16 = the article title
const HEAD_MIN  = 11;   // Avara-Bold 11–15 = a section heading
const SUBHEAD_MIN = 10; // Avara-Bold ~10 mid-page = a sub-heading

// ─── line classification ─────────────────────────────────────────────────────
const headingLevel = (l) =>
	isAvara(l.font) && l.size >= TITLE_MIN ? "title"
	: isAvara(l.font) && l.size >= HEAD_MIN ? "h2"
	: isAvara(l.font) && l.size >= SUBHEAD_MIN ? "h3"
	: null;
// A dice-table caption that immediately precedes the roll/result rows. The label is set in a display
// face — Avara ("1d12 theme"), or in some articles (e.g. Primordial powers) the Fell face
// ("1d12 why it incarnated"). The leading dice formula is often a separate bold-body span, so we
// test the text pattern + a display-face label span rather than the line font. The dice prefix is
// the discriminator, so plain Fell run-in sub-headings ("Structure", "Purpose") aren't caught.
const isTableHeader = (l) =>
	l.size >= HEAD_MIN && (
		(isAvara(l.font) && (/\dd\d/i.test(l.text) || l.spans.some((s) => isFell(s.font))))
		|| (/^\s*\d*d\d+\s+\S/.test(l.text) && l.spans.some((s) => s.text.trim() && (isAvara(s.font) || isFell(s.font))))
	);
// A roll cell is "N" or "N-M". Cap at 100 (max die) so stray furniture like a footer page number
// ("214") that clusters at a table's edge isn't mistaken for a 13th roll row.
const rollToken = (t) => {
	t = t.trim();
	const m = t.match(/^(\d+)\s*[–-]\s*(\d+)$/);
	if (m) return +m[1] <= 100 && +m[2] <= 100;
	return /^\d+$/.test(t) && +t <= 100;
};
const isTableRow = (row) => row.cells.length >= 2 && rollToken(row.cells[0].text);
// Some table rows arrive as one cell — the roll and result aren't far enough apart in x to split
// (e.g. the wide "11-12 …" rows). Split a single cell that begins with a roll token into a roll
// line + a result line (preserving the result's emphasis spans) so the row isn't dropped.
function splitRollLine(l) {
	const m = l.text.match(/^\s*(\d+\s*[–-]\s*\d+|\d+)\s+(\S[\s\S]*)$/);
	if (!m) return null;
	if (Math.max(...m[1].match(/\d+/g).map(Number)) > 100) return null; // a roll >100 is furniture (e.g. a page number), not a die result
	let drop = l.text.length - m[2].length; // chars before the result text (roll + spaces)
	const rest = [];
	for (const s of l.spans) {
		if (drop > 0 && drop >= s.text.length) { drop -= s.text.length; continue; }
		if (drop > 0) { rest.push({ ...s, text: s.text.slice(drop) }); drop = 0; }
		else rest.push(s);
	}
	const mk = (text, spans) => ({ bbox: l.bbox.slice(), text, font: l.font, size: l.size, spans });
	return { roll: mk(m[1], [{ font: "", size: l.size, text: m[1] }]), rest: mk(m[2], rest.length ? rest : [{ font: "", size: l.size, text: m[2] }]) };
}
const isDiceLabel = (t) => /^\d*d\d+$/i.test(t.trim()); // "1d6", "d6", "1d12"
const isDiceHeaderRow = (row) => row.cells.length >= 2 && isDiceLabel(row.cells[0].text);
// Value tables (e.g. Marshedge "Goods | value"): a label, then a lone number far to the right.
const valueCell = (row) => {
	const c = row.cells[row.cells.length - 1];
	// a value is a number, optionally with a footnote asterisk ("0", "0*", "*1")
	return row.cells.length >= 2 && /^\*?\d+\*?$/.test(c.text.trim()) && c.bbox[0] > row.cells[0].bbox[0] + 100 ? c : null;
};
const isValueHeaderRow = (row) => row.cells.length >= 2 && /^value$/i.test(row.cells[row.cells.length - 1].text.trim());
// A check-marker cell (◇/○) injected from the vector layer (load.js). In a value table these are the
// per-item checkbox glyphs; they sometimes land on their own row (a y-quantisation split) or as the
// leading cell of an item row, so they must be skipped/stripped when reading the table.
const isMarkerCell = (c) => c.font === "marker" || /^[◇○□◻]+$/.test((c.text || "").trim());
const rowContentCells = (row) => row.cells.filter((c) => !isMarkerCell(c));
// First value row at/after `from`, skipping lone ◇/○ checkbox-marker rows; -1 if the next content
// row isn't a value row. Lets the value-table branch start past markers (Barrier Pass arms-and-armor).
const firstValueRow = (rows, from) => {
	let j = from;
	while (j < rows.length && rows[j].cells.length && rowContentCells(rows[j]).length === 0) j++;
	return rows[j] && valueCell(rows[j]) ? j : -1;
};
// A bullet's glyph isn't always in the text layer; the book's list-item *first* lines instead
// carry exactly two leading spaces (continuation lines have 0 or 3+). Combined with an explicit
// dingbat run or a leading bullet glyph, that's the item-start signal.
const leadSpaces = (l) => (l.text.match(/^ */)[0].length);
// Note: "…" is NOT a bullet — a "…"-led line is a pick-list option that renders on its own line
// (see joinLines), kept under its prompt rather than turned into a separate <li>.
const isItemStart = (l) =>
	(l.spans.length > 0 && (isDingbat(l.spans[0].font) || /^swirl/.test(l.spans[0].font)))
	|| /^[•◦‣▪○◇●◆□◻]/.test(l.text.trim()) || /^ä\s/.test(l.text.trim()) || leadSpaces(l) === 2;
// A short, fully-AVARA line standing alone is a run-in sub-heading, e.g. "Various treasures" or the
// Impressions seasons ("Spring"). The display (Avara) face is the signal: a bold BODY line
// (ACaslonPro-Bold) is a lead-in label or a bolded sentence, not a heading — e.g. Barrow's "Everyone
// knows:" or Welcome's "It's okay for players to read this book…" — so those stay paragraph text.
// (Stat-block names are also Avara but captured earlier by the stat-block detector via their HP line,
// so they never reach this.) Leading 2-space indent doesn't matter: Avara is never body list text.
const isBoldRunIn = (l) => {
	const t = l.spans.filter((s) => s.text.trim());
	return t.length > 0 && t.every((s) => isAvara(s.font)) && !isFieldLine(l) && l.text.trim().length < 50;
};
// The book sets some sub-headings (e.g. the Ruin's "Structure", "Purpose", "Architectural
// elements") in a small-caps Fell face; the text comes through lowercase, so detect a fully-Fell
// line as a run-in heading and capitalize it. (Mixed Avara+Fell lines are table headers — excluded.)
const isFellRunIn = (l) => {
	const t = l.spans.filter((s) => s.text.trim());
	return t.length > 0 && t.every((s) => isFell(s.font)) && l.text.trim().length < 60;
};

// ─── stat blocks ─────────────────────────────────────────────────────────────
// A monster stat block: a small Avara-Bold name, an italic tags line, then HP/Armor/Damage/
// Instinct/Special-quality fields and dingbat ("ä") move bullets. Anchored on the HP line.
const isStatName = (l) => isAvara(l.font) && l.size < HEAD_MIN;
const isItalicLine = (l) => l.spans.length > 0 && l.spans.every((s) => isItalic(s.font) || !s.text.trim());
const isFieldLine = (l) => /^(HP\b|Armor\b|Damage\b|Instinct\b|Special qualit)/i.test(l.text.trim());
const isHpLine = (l) => /^HP\b/i.test(l.text.trim());
const hpAhead = (rows, i) => {
	// Look a few rows ahead for the HP line — a name can be followed by an icon and one or two
	// wrapped tag lines before HP (e.g. Bronze colossus, Iron hound, Draventao).
	for (let j = i; j < Math.min(rows.length, i + 6); j++) if (rows[j].cells.length === 1 && isHpLine(rows[j].cells[0])) return true;
	return false;
};
const looksStatStart = (rows, i) => {
	const r = rows[i];
	if (r.cells.length !== 1) return false;
	const l = r.cells[0];
	return (isStatName(l) || isItalicLine(l) || isFieldLine(l)) && (isHpLine(l) || hpAhead(rows, i));
};

/** Collect a stat block's lines from row i; ends at a heading, the next creature name, or column end. */
function collectStatBlock(rows, i) {
	const lines = [];
	let seenHp = false, icon = null, j = i;
	for (; j < rows.length; j++) {
		const r = rows[j];
		if (r.cells.length !== 1) { lines.push(...r.cells); continue; }
		const l = r.cells[0];
		if (l.image && l.image.w < 60 && !seenHp) { icon ??= l.image; continue; } // the creature's marker icon
		if (l.rule || l.image || l.boxStart || l.boxEnd) break;
		if (headingLevel(l) && !isTableHeader(l) && l.size >= HEAD_MIN) break; // a real section heading
		if (isStatName(l) && seenHp) break; // the next creature's block
		if (isHpLine(l)) seenHp = true;
		lines.push(l);
	}
	return { endIdx: j, lines, icon };
}

// ─── settlement (steading) stat block ─────────────────────────────────────────
// The book's settlement "place" block: a "Size … (town/village/…)" line, then bold Population /
// Prosperity / Defenses fields, with bulleted Trade / Resources / Defenses lists, all indented a
// few pt past the column base (the body prose resumes flush at the base). Anchored on Size +
// Population, like the monster block is anchored on the name + HP.
const isSizeLine = (l) => /^Size\b/i.test(l.text.trim());
const popAhead = (rows, i) => {
	for (let j = i + 1; j < Math.min(rows.length, i + 4); j++) if (rows[j].cells.length === 1 && /^Population\b/i.test(rows[j].cells[0].text.trim())) return true;
	return false;
};
const looksSettlementStart = (rows, i) => rows[i].cells.length === 1 && isSizeLine(rows[i].cells[0]) && popAhead(rows, i);

/** Collect a settlement block from row i; ends at a real heading or when the body prose returns to
 *  the column base (the block's fields/lists sit indented past it). */
function collectSettlementBlock(rows, i, base) {
	const lines = [];
	let j = i;
	for (; j < rows.length; j++) {
		const r = rows[j];
		if (r.cells.length !== 1) { lines.push(...r.cells); continue; }
		const l = r.cells[0];
		if (l.rule || l.image || l.boxStart || l.boxEnd) break;
		if (headingLevel(l) && !isTableHeader(l) && l.size >= HEAD_MIN) break;
		if (l.bbox[0] <= base + 4) break; // body prose, flush at the base — the block is done
		lines.push(l);
	}
	return { endIdx: j, lines };
}

// ─── geometry ────────────────────────────────────────────────────────────────
/** Strip furniture, cluster columns; return `{ columns:[{base,lines,rules,images}], pageNumbers }`. */
export function orderColumns(page, rules = [], images = []) {
	const H = page.height;
	const pageNumbers = [];
	const body = [];
	for (const line of page.lines) {
		const [x0, y0] = line.bbox;
		const txt = line.text.trim();
		if (isAvara(line.font) && line.size <= 11 && y0 > H - 30 && /^\d+$/.test(txt)) { pageNumbers.push(Number(txt)); continue; }
		if (isAvara(line.font) && line.size < TITLE_MIN && y0 < 70) continue; // running header
		body.push(line);
	}
	const xs = body.map((l) => l.bbox[0]).sort((a, b) => a - b);
	const bases = [];
	// New column only on a gap wider than an intra-column indent (~130px max) but narrower than the
	// real ~168px column pitch — so indented content (settlement values, hanging lists) stays in
	// its column instead of spawning a spurious narrow column.
	for (const x of xs) if (!bases.length || x - bases[bases.length - 1] > 150) bases.push(x);
	const colOf = (x0) => { let i = 0; while (i + 1 < bases.length && bases[i + 1] <= x0 + 8) i++; return i; };
	const cols = bases.map((base) => ({ base, lines: [], rules: [], images: [] }));
	for (const line of body) cols[colOf(line.bbox[0])].lines.push(line);
	for (const r of rules) if (cols.length) cols[colOf(r.x)].rules.push(r);
	for (const im of images) if (cols.length) cols[colOf(im.x + (im.w || 0) / 2)].images.push(im);
	for (const c of cols) c.lines.sort((a, b) => a.bbox[1] - b.bbox[1]);
	return { columns: cols, pageNumbers };
}

/** Merge a row's cells (a single text line mutool split by x) into one synthetic line. */
function mergeLine(cells) {
	const spans = [];
	for (let k = 0; k < cells.length; k++) {
		if (k > 0) spans.push({ font: "", size: cells[k].size, text: " " });
		spans.push(...cells[k].spans);
	}
	return { bbox: cells[0].bbox.slice(), text: cells.map((c) => c.text).join(" "), font: cells[0].font, size: cells[0].size, spans };
}

/** Cluster a column's lines into rows by y-proximity (so a table's cells share a row). */
function groupRows(lines) {
	const rows = [];
	for (const l of [...lines].sort((a, b) => a.bbox[1] - b.bbox[1])) {
		const last = rows[rows.length - 1];
		if (last && Math.abs(l.bbox[1] - last.y0) <= 5) last.cells.push(l);
		else rows.push({ y0: l.bbox[1], cells: [l] });
	}
	for (const r of rows) {
		r.cells.sort((a, b) => a.bbox[0] - b.bbox[0]);
		// A multi-cell row that isn't a roll/result table row is just one line split by x — re-join it,
		// so hanging-indent list items like "A | maul of black iron" stay a single list line.
		if (r.cells.length > 1 && !isTableRow(r) && !isDiceHeaderRow(r) && !valueCell(r) && !isValueHeaderRow(r)) r.cells = [mergeLine(r.cells)];
	}
	return rows;
}

/** Merge the column's dividers and inline images into its rows as standalone marker rows, by y. */
function insertRuleRows(rows, rules, images) {
	const extra = [];
	// A small leading icon (e.g. a people portrait) sits on the same baseline as its entry's first
	// line but a hair below it — snap its row just above that line so it precedes the entry rather
	// than splitting it into two paragraphs.
	const snap = (im) => { if (im.w >= 60) return im.y; const r = rows.find((r) => Math.abs(r.y0 - im.y) <= 6); return r ? r.y0 - 0.01 : im.y; };
	for (const r of (rules || [])) extra.push({ y0: r.y, cells: [{ rule: true, kind: r.kind, bbox: [r.x, r.y, r.x + r.width, r.y], text: "", spans: [] }] });
	for (const im of (images || [])) {
		if (im.box) {
			// A thin frame → wrap the content it encloses in a box (markers at its top and bottom).
			extra.push({ y0: im.y, cells: [{ boxStart: true, bbox: [im.x, im.y], text: "", spans: [] }] });
			extra.push({ y0: im.y + (im.h || 0), cells: [{ boxEnd: true, bbox: [im.x, im.y], text: "", spans: [] }] });
		} else {
			extra.push({ y0: snap(im), cells: [{ image: im, bbox: [im.x, im.y], text: "", spans: [] }] });
		}
	}
	if (!extra.length) return rows;
	return [...rows, ...extra].sort((a, b) => a.y0 - b.y0);
}

// ─── segmentation ────────────────────────────────────────────────────────────
function segmentColumn(rows, base) {
	const blocks = [];
	const isHead = (l) => headingLevel(l) && !isTableHeader(l);
	for (let i = 0; i < rows.length; ) {
		const row = rows[i];
		const c0 = row.cells[0];

		// SECTION DIVIDER (a thin line or braid from the vector layer).
		if (c0?.rule) { blocks.push({ type: "rule", kind: c0.kind }); i++; continue; }
		// INLINE IMAGE / ICON placed in the column flow at its position. If a stat block starts on
		// the next row, the icon is the creature's marker → fold it into that block.
		if (c0?.image) {
			if (c0.image.w < 60 && looksStatStart(rows, i + 1)) {
				const { endIdx, lines, icon } = collectStatBlock(rows, i + 1);
				blocks.push({ type: "statblock", lines, icon: icon || c0.image });
				i = endIdx; continue;
			}
			blocks.push({ type: "image", image: c0.image }); i++; continue;
		}
		// BOX FRAME boundaries — wrap the enclosed content.
		if (c0?.boxStart) { blocks.push({ type: "boxstart" }); i++; continue; }
		if (c0?.boxEnd) { blocks.push({ type: "boxend" }); i++; continue; }

		// STAT BLOCK — anchored on an HP line; capture name/tags through the moves.
		if (looksStatStart(rows, i)) {
			const { endIdx, lines, icon } = collectStatBlock(rows, i);
			blocks.push({ type: "statblock", lines, icon });
			i = endIdx;
			continue;
		}
		// SETTLEMENT BLOCK — anchored on the "Size … / Population" fields; one bordered card.
		if (looksSettlementStart(rows, i)) {
			const { endIdx, lines } = collectSettlementBlock(rows, i, base);
			blocks.push({ type: "settlement", lines });
			i = endIdx;
			continue;
		}
		// TABLE — roll/result rows, optionally preceded by a dice header. The header is either one
		// Avara cell ("1d12 theme") or a split "1d6" + small-caps name (the d6 site/sign tables).
		const singleHead = row.cells.length === 1 && isTableHeader(c0);
		if (isTableRow(row) || ((singleHead || isDiceHeaderRow(row)) && rows[i + 1] && isTableRow(rows[i + 1]))) {
			let header = null;
			if (singleHead) {
				const m = c0.text.trim().match(/^(\d*d\d+)\s+(.*)$/i);
				header = m ? { roll: m[1], label: m[2] } : { roll: "", label: c0.text.trim() };
				i++;
			} else if (isDiceHeaderRow(row)) {
				header = { roll: row.cells[0].text.trim(), label: row.cells.slice(1).map((c) => c.text.trim()).join(" ") };
				i++;
			}
			const trows = [];
			let rollX = null;
			while (i < rows.length) {
				const r = rows[i];
				let split;
				if (isTableRow(r)) {
					trows.push({ roll: r.cells[0], rest: r.cells.slice(1) });
					rollX ??= r.cells[0].bbox[0];
					i++;
				} else if (r.cells.length === 1 && !r.cells[0].rule && !isHead(r.cells[0]) && (split = splitRollLine(r.cells[0]))) {
					trows.push({ roll: split.roll, rest: [split.rest] }); // a roll+result that arrived as one cell
					rollX ??= split.roll.bbox[0];
					i++;
				} else if (trows.length && r.cells.length === 1 && !r.cells[0].rule && !isHead(r.cells[0])
					&& r.cells[0].bbox[0] > rollX + 15) {
					trows[trows.length - 1].rest.push(r.cells[0]); // wrapped result line
					i++;
				} else break;
			}
			blocks.push({ type: "table", header, rows: trows });
			continue;
		}
		// VALUE TABLE — a "<label> value" header (e.g. Goods | value), then label→number rows
		// (the label may wrap across lines that have no value cell). The first value row is found by
		// skipping any lone ◇/○ checkbox-marker rows after the header (Barrier Pass "arms and armor").
		const vStart = isValueHeaderRow(row) ? firstValueRow(rows, i + 1) : -1;
		if (vStart >= 0) {
			const headLabel = rowContentCells(row).slice(0, -1).map((c) => c.text.trim()).join(" ");
			i = vStart;
			const trows = [];
			let valX = null, lastY = 0;
			while (i < rows.length) {
				const r = rows[i];
				if (r.cells.length && rowContentCells(r).length === 0) { i++; continue; } // a lone ◇/○ checkbox row
				const v = valueCell(r);
				if (v) {
					valX ??= v.bbox[0];
					trows.push({ label: r.cells.filter((c) => c !== v && !isMarkerCell(c)), value: v });
					lastY = r.y0; i++;
				} else if (trows.length && r.cells.length === 1) {
					const l = r.cells[0];
					// Stop at a footnote ("*…"), a box edge, a heading, the value column, or a big
					// vertical gap (a callout below the table) — don't fold those into the last row.
					if (l.rule || l.image || l.boxStart || l.boxEnd || isHead(l) || /^\*/.test(l.text.trim())
						|| r.y0 - lastY > 13 || l.bbox[0] >= (valX ?? Infinity) - 20) break;
					trows[trows.length - 1].label.push(l); lastY = r.y0; i++;
				} else break;
			}
			blocks.push({ type: "valuetable", header: headLabel, rows: trows });
			continue;
		}
		// HEADING (Avara display font). A heading that wraps onto a second line (same level, the next
		// row also a heading line right below — e.g. "Should the players" / "read this?") is joined
		// into one heading.
		if (row.cells.length === 1 && isHead(c0)) {
			const level = headingLevel(c0);
			let j = i;
			while (level !== "title" && rows[j + 1]?.cells.length === 1 && isHead(rows[j + 1].cells[0])
				&& headingLevel(rows[j + 1].cells[0]) === level && rows[j + 1].y0 - rows[j].y0 < c0.size * 1.8) j++;
			const line = j > i ? { ...c0, text: rows.slice(i, j + 1).map((r) => r.cells[0].text.trim()).join(" ") } : c0;
			blocks.push(level === "title" ? { type: "title", line } : { type: "heading", level, line });
			i = j + 1; continue;
		}
		// RUN-IN SUB-HEADING (a short, fully-bold body line, e.g. "Various treasures") → <h3>.
		if (row.cells.length === 1 && isBoldRunIn(c0)) {
			blocks.push({ type: "heading", level: "h3", line: c0 });
			i++; continue;
		}
		// FELL SMALL-CAPS SUB-HEADING (e.g. the Ruin's "Structure"/"Purpose") → <h3>, capitalized.
		if (row.cells.length === 1 && isFellRunIn(c0)) {
			blocks.push({ type: "heading", level: "h3", line: c0, cap: true });
			i++; continue;
		}
		// ARTIFACT QUALITIES — a short, italic-led line right under a title (e.g. "◇ magical, beautiful,
		// Value 4" — an optional diamond marker, italic qualities, an optional roman "Value N"), then
		// the regular description. Keep it on its own line instead of being swallowed into the
		// description paragraph or read as a list item (the diamond looks like a bullet). The "next
		// line is regular text" guard distinguishes it from a multi-item diamond list and from italic
		// example prose (which stays italic). Must run before the list branch since ◇ is item-start.
		const startsItalic = (l) => { const s = l.spans.find((x) => x.text.trim() && x.font !== "marker"); return s && isItalic(s.font); };
		const plainTags = (l) => !startsItalic(l) && !/^[◇○]/.test(l.text.trim());
		if (row.cells.length === 1 && startsItalic(c0) && blocks[blocks.length - 1]?.type === "heading"
			&& c0.text.trim().length < 60 && rows[i + 1]?.cells.length === 1 && plainTags(rows[i + 1].cells[0])) {
			blocks.push({ type: "para", lines: [c0], tags: true });
			i++; continue;
		}
		// LIST — item starts plus their continuation lines (either hanging-indented, as in the
		// Questions lists, or just vertically tight under the item, as in dingbat-bulleted lists).
		if (row.cells.length === 1 && isItemStart(c0)) {
			const items = [];
			let prevY = row.y0;
			while (i < rows.length && rows[i].cells.length === 1) {
				const l = rows[i].cells[0];
				const gap = rows[i].y0 - prevY;
				if (l.rule || l.image || l.boxStart || l.boxEnd || isHead(l) || isBoldRunIn(l) || isFellRunIn(l)) break;
				if (isItemStart(l)) items.push([l]);
				// A continuation hangs under its item — it may be indented past the base or just tight
				// under it, but it is never far LEFT of the item's own start. A flush body line below an
				// *indented* bullet (e.g. an arcanum's "◇ tags" line sitting above flush description
				// prose) is a new block, not a wrap of the bullet.
				else if (items.length && (l.bbox[0] > base + 3 || gap <= l.size * 1.7) && l.bbox[0] >= items[items.length - 1][0].bbox[0] - 8) items[items.length - 1].push(l);
				else break;
				prevY = rows[i].y0; i++;
			}
			blocks.push({ type: "list", items });
			continue;
		}
		// PARAGRAPH — consecutive single-cell body rows, split on a vertical gap.
		if (row.cells.length === 1) {
			const lines = [c0]; let prevY = row.y0; i++;
			while (i < rows.length && rows[i].cells.length === 1) {
				const l = rows[i].cells[0];
				if (l.rule || l.image || l.boxStart || l.boxEnd || isHead(l) || isItemStart(l) || isBoldRunIn(l) || isFellRunIn(l)) break;
				if (rows[i].y0 - prevY > l.size * 1.7) break;
				lines.push(l); prevY = rows[i].y0; i++;
			}
			blocks.push({ type: "para", lines });
			continue;
		}
		// Fallback: a multi-cell, non-table row → join its cells as one line.
		blocks.push({ type: "para", lines: row.cells });
		i++;
	}

	// A small marker icon should prefix the thing it sits beside, not be its own block: a heading
	// (e.g. the "!" by "Oathbreaker's curse"), or — in the "people" sections, where a round portrait
	// sits in the left margin of the entry that describes it — the paragraph it leads (same row, the
	// paragraph's first line starting just to the icon's right).
	for (let k = 0; k < blocks.length; k++) {
		const b = blocks[k];
		if (b.type !== "image" || b.image.w >= 60) continue;
		const near = [blocks[k - 1], blocks[k + 1]];
		const heading = near.find((nb) => nb?.type === "heading" && Math.abs(nb.line.bbox[1] - b.image.y) < 18);
		const para = heading || near.find((nb) => nb?.type === "para" && nb.lines[0] && Math.abs(nb.lines[0].bbox[1] - b.image.y) < 12 && nb.lines[0].bbox[0] > b.image.x);
		if (para) { (para.icons ??= []).push(b.image); blocks.splice(k, 1); k--; }
	}

	// In the "people" sections each entry is a short paragraph led by a portrait icon; keep them as
	// separate icon-led paragraphs (the icon was attached above) rather than merging into one flowing
	// block — the book lays them out as distinct entries.
	return blocks;
}

/**
 * Turn one column's raw stext lines (plus its dividers/images) into typed blocks — the exact
 * `groupRows → insertRuleRows → segmentColumn` pipeline `extractArticle` runs per column, exposed for
 * callers that carve their own regions out of a page (e.g. the minor-arcana card grid, whose cards
 * the generic column clusterer can't see). `base` seeds settlement-block indentation; it defaults to
 * the region's left edge.
 */
export function linesToBlocks(lines, { rules = [], images = [], base } = {}) {
	const b = base ?? (lines.length ? Math.min(...lines.map((l) => l.bbox[0])) : 0);
	return segmentColumn(insertRuleRows(groupRows(lines), rules, images), b);
}

/**
 * A long dice table whose rows run off the bottom of one column and continue at the top of the next
 * is emitted as two `table` blocks (neither tiling 1..N, so neither parses as rollable). Merge a
 * continuation — the next column's first block, a table with a blank or identical header whose rolls
 * pick up exactly where the previous column's last table left off — back into the first. Columns are
 * walked left-to-right by base x (reading order, across the L/R printed-page boundary too).
 */
function mergeSplitTables(cols) {
	const ordered = [...cols].sort((a, b) => a.base - b.base);
	const rollNums = (cell) => (cell?.text?.match(/\d+/g) || []).map(Number);
	for (let i = 0; i < ordered.length - 1; i++) {
		const t1 = ordered[i].blocks.at(-1), t2 = ordered[i + 1].blocks[0];
		if (t1?.type !== "table" || t2?.type !== "table" || !t1.rows.length || !t2.rows.length) continue;
		const sameHeader = !t2.header || (t1.header && t2.header.label === t1.header.label);
		const lastMax = Math.max(-Infinity, ...rollNums(t1.rows.at(-1).roll));
		const firstMin = Math.min(Infinity, ...rollNums(t2.rows[0].roll));
		if (sameHeader && lastMax + 1 === firstMin) { t1.rows.push(...t2.rows); ordered[i + 1].blocks.shift(); }
	}
}

/**
 * Full extraction for an article spanning one or more spreads. Returns a renderer-agnostic
 * document: per-spread `sections`, each split into the left printed page's columns (A | B) and the
 * right printed page's columns (C | D) — the renderer stacks them with a braid separator. Banners
 * (full-width illustrations) and a single-creature NPC-box wrap are recorded as structure, not
 * markup. `pageRules[i]`/`pageImages[i]` are the divider/illustration positions for `pages[i]`
 * (from mutool trace). Blocks are the typed objects from `segmentColumn`; assets are referenced by
 * the position object (carrying `.file`) and resolved at render time.
 */
export function extractArticle(pages, { title, pageRules = [], pageImages = [] } = {}) {
	const pageNumbers = [];
	let bookTitle = "";
	const byY = (a, b) => a.y - b.y;

	const sections = [];
	pages.forEach((page, idx) => {
		const imgs = pageImages[idx] || [];
		// An illustration spanning more than one column of a printed page can't sit inline in a single
		// column without splitting its text — treat it as a banner (placed above/below the columns).
		// A printed page is half the spread (~2 columns), so >40% of the spread width spans both of a
		// page's columns; ≤1.5 columns (≤~33%) stays inline.
		const banners = imgs.filter((im) => im.w >= page.width * 0.40);
		const colImgs = imgs.filter((im) => im.w < page.width * 0.40);
		const { columns, pageNumbers: nums } = orderColumns(page, pageRules[idx] || [], colImgs);
		pageNumbers.push(...nums);

		const cols = columns.map((col) => ({
			base: col.base,
			blocks: segmentColumn(insertRuleRows(groupRows(col.lines), col.rules, col.images), col.base),
		}));
		mergeSplitTables(cols);

		// An inline illustration dropped into the middle of a paragraph splits the sentence (e.g.
		// Death's "…tethered" / image / "to his bones."; crinwin's "nurs-" / image / "eries"). When an
		// image sits between a paragraph and a lowercase-led continuation, rejoin the paragraph
		// (joinLines then de-hyphenates the break) and hoist the image to the page's bottom banners so
		// it sits below the text instead of breaking it.
		const hoisted = [];
		for (const c of cols) {
			for (let k = 1; k < c.blocks.length - 1; k++) {
				const b = c.blocks[k], prev = c.blocks[k - 1], next = c.blocks[k + 1];
				if (b.type === "image" && b.image.w >= 60 && prev.type === "para" && next.type === "para"
					&& /^[a-z]/.test((next.lines[0]?.text || "").trim())) {
					prev.lines.push(...next.lines);
					c.blocks.splice(k, 2);
					hoisted.push(b.image);
					k--;
				}
			}
		}

		// The article title comes through as a `title` block on one of the columns.
		for (const c of cols) for (const b of c.blocks) if (b.type === "title") bookTitle ||= b.line.text.trim();

		// A spread that is a single creature's entry — exactly one stat block, at the top of the
		// leftmost column — becomes one NPC box; its second column, tables, and illustration all sit
		// inside it, and the creature name is promoted to the box title.
		let npc = null;
		const stats = cols.flatMap((c) => c.blocks.filter((b) => b.type === "statblock").map((b) => ({ b, base: c.base })));
		if (stats.length === 1) {
			const { b, base } = stats[0];
			const leftmost = Math.min(...cols.map((c) => c.base));
			if (base === leftmost && b.lines[0] && b.lines[0].bbox[1] < 140) { npc = { title: b.lines[0].text.trim(), icon: b.icon }; b.promoted = true; }
		}

		const midX = page.width / 2;
		sections.push({
			bannersTop: banners.filter((im) => im.y < page.height * 0.45).sort(byY),
			bannersBottom: [...banners.filter((im) => im.y >= page.height * 0.45), ...hoisted].sort(byY),
			left: cols.filter((c) => c.base < midX),   // printed page 1 (A | B)
			right: cols.filter((c) => c.base >= midX), // printed page 2 (C | D)
			npc,
		});
	});

	return { title: title || bookTitle, bookTitle, pageNumbers, sections };
}
