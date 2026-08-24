// Parse Book I's Value guide (printed pp. 92-93) — the ladder of what a Value 0-4 item is "generally
// worth", the notes that qualify it, and the Coins sidebar. The value TABLES (items.js) price each
// object; this is the page that says what a price means, so the reference journal prints both.
//
// The page is a plain multi-column text spread, so the structure comes from the column grid plus
// indentation: a paragraph sits flush at its column's left edge, a swirl-bulleted item is indented a
// few points, and its wrapped lines are indented further. The ◇ load diamonds inside the prose ("A ◇
// purse of copper coins") are vector art, spliced in from the marker layer exactly as the tables do.

import { loadStext } from "./stext.js";
import { loadMarkers } from "./rules.js";
import { isAvara, isItalic } from "./fonts.js";
import { attachTableMarkers, statMarkdown } from "./items.js";

/** One rung of the ladder: "A Value 2 item is generally worth:" and everything the book lists under it. */
export class ValueTier {
	constructor(value) {
		this.value        = value;
		this.equivalences = [];   // markdown strings, in the book's order
	}
}

/** The Coins sidebar: its prose, then its bulleted definitions of coin / handful / ◇ purse. */
export class CoinsSection {
	constructor() {
		this.paragraphs = [];
		this.bullets    = [];
	}
}

/** Everything the Value spread says, as the reference page needs it. */
export class ValueGuide {
	constructor() {
		this.lead  = "";          // "Exchange rates are far from standard, but…"
		this.tiers = [];
		this.notes = [];          // the "* Exotic trade goods…" footnote and the paragraph after it
		this.coins = new CoinsSection();
	}
}

const TIER_HEAD = /^A Value (\d) item is generally worth:?\s*$/i;
const COINS_HEAD = /^coins$/i;
const font = (l) => l.spans?.[0]?.font ?? l.font ?? "";

/**
 * The column left-edges the page is set on. A column edge is where MANY lines start, so the left
 * edges are the peaks of a line-count histogram — clustering every distinct x would promote each
 * indent level (bullets, wraps) into a column of its own.
 */
export function columnLefts(lines, { minLines = 3, tolerance = 20 } = {}) {
	const counts = new Map();
	for (const l of lines) {
		const x = Math.round(l.bbox[0]);
		counts.set(x, (counts.get(x) ?? 0) + 1);
	}
	const peaks = [...counts.entries()].filter(([, n]) => n >= minLines).map(([x]) => x).sort((a, b) => a - b);
	const cols = [];
	for (const x of peaks) if (!cols.length || x - cols[cols.length - 1] > tolerance) cols.push(x);
	return cols;
}

/** Assign a line to the rightmost column edge at or left of it, so a mid-column fragment stays with
 *  the column it is set in. */
const columnOf = (l, lefts) => lefts.filter((x) => l.bbox[0] >= x - 2).pop() ?? lefts[0];

/** Group a column's lines into visual rows (same y ±5), each read left-to-right. */
function visualRows(lines) {
	const rows = [];
	let top = -Infinity;
	for (const l of [...lines].sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0])) {
		if (l.bbox[1] - top > 5) { rows.push([]); top = l.bbox[1]; }
		rows[rows.length - 1].push(l);
	}
	return rows.map((r) => r.sort((a, b) => a.bbox[0] - b.bbox[0]));
}

// How far a row's leftmost line sits from its column edge tells you what it is: flush = prose, a few
// points in = a bulleted item, further = a wrapped continuation of whatever it follows.
const FLUSH = 3, BULLET = 10;
// Body leading runs ~8-14pt and the space between paragraphs ~21pt, so a gap this size is a new
// paragraph rather than the next line of the current one.
const PARA_GAP = 16;

/** Segment one column into `{ kind: "para" | "item", lines }` blocks — wraps fold into the block they
 *  continue, and consecutive flush rows fold into one paragraph until the book leaves a gap. */
export function segmentColumn(rows, left) {
	const blocks = [];
	let prevBottom = -Infinity;
	for (const row of rows) {
		const x = Math.min(...row.map((l) => l.bbox[0]));
		const top = Math.min(...row.map((l) => l.bbox[1]));
		const kind = x <= left + FLUSH ? "para" : x <= left + BULLET ? "item" : "wrap";
		const last = blocks[blocks.length - 1];
		if (kind === "wrap" && last) last.lines.push(...row);
		else if (kind === "para" && last?.kind === "para" && top - prevBottom < PARA_GAP) last.lines.push(...row);
		else blocks.push({ kind: kind === "wrap" ? "para" : kind, lines: [...row] });
		prevBottom = top;
	}
	return blocks;
}

const blockText = (b) => statMarkdown(b.lines).trim();

/**
 * Read the Value guide off its spread. Column order is reading order, so the ladder accumulates
 * across columns; the Coins sidebar is whichever column its heading opens, and the in-fiction example
 * running down the outer column (set wholly in italics) defines nothing and is skipped.
 */
export function parseValueGuide(page) {
	const guide = new ValueGuide();
	const heads = page.lines.filter((l) => isAvara(font(l)));
	const body = page.lines.filter((l) => !isAvara(font(l)));
	const lefts = columnLefts(body);
	const coinsHead = heads.find((l) => COINS_HEAD.test(l.text.trim()));
	const coinsLeft = coinsHead ? columnOf(coinsHead, lefts) : null;

	let tier = null;
	for (const left of lefts) {
		const col = body.filter((l) => columnOf(l, lefts) === left);
		if (!col.length || col.every((l) => isItalic(font(l)))) continue;

		for (const block of segmentColumn(visualRows(col), left)) {
			const text = blockText(block);
			if (!text) continue;
			if (left === coinsLeft) {
				if (block.kind === "item") guide.coins.bullets.push(text);
				else guide.coins.paragraphs.push(text);
				continue;
			}
			const head = text.match(TIER_HEAD);
			if (head) { tier = new ValueTier(Number(head[1])); guide.tiers.push(tier); continue; }
			if (block.kind === "item" && tier) tier.equivalences.push(text);
			else if (!tier && !guide.lead) guide.lead = text;
			else if (block.kind === "para") guide.notes.push(text);
		}
	}
	return guide;
}

/** Find the Value spread in `window` and parse it, markers spliced in. */
export function loadValueGuide(pdf, { window = "40-60", anchor = TIER_HEAD } = {}) {
	const pages = loadStext(pdf, window);
	const idx = pages.findIndex((p) => p.lines.some((l) => anchor.test(l.text.trim())));
	if (idx === -1) throw new Error(`Value guide: no page in ${window} of ${pdf} matches ${anchor}`);
	const pdfPage = Number(window.split("-")[0]) + idx;
	attachTableMarkers(pages[idx], loadMarkers(pdf, pdfPage));
	return { guide: parseValueGuide(pages[idx]), pdfPage };
}
