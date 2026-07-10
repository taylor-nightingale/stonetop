// Geometric parser for Book II's Minor Arcana appendix (APPENDIX C). Unlike the rest of the book,
// the minor arcana are printed as a **grid of cut-out cards** — ~4 per page, each a front sub-column
// (the item) beside a back sub-column (the spell), with the title at the card top and a
// `front · <N> · back` strip at the bottom. The generic column pipeline flattens that grid into
// reading order and scrambles it (titles vanish, cards bleed together), so we segment the cards
// ourselves off page geometry and hand each sub-column to the shared block builder.
//
// The card layout is self-contained — number, side labels, and both titles are all on the page — so
// this depends on nothing from the hand-authored pack data.
import { isAvara, isFell } from "./fonts.js";
import { linesToBlocks } from "./layout.js";

// Card titles/sub-heads are Avara-Bold ~8pt, below layout's heading thresholds; bump them so the
// block builder classifies them as headings (body text is ACaslon, so only titles are Avara).
const HEADING_SIZE = 11;
const STRIP_PAD = 6;   // vertical gap kept clear of the front/back/number strip
const TOP_MARGIN = 20; // below the running header, where the first card row starts

/**
 * Detect the card footers on a page. Each is a `front … <N> … back` strip: a Fell "front" label, a
 * Fell "back" label to its right on the same baseline, and an Avara card number between them. Returns
 * `[{ number, centerX, y }]` (the number is null if not found), sorted top-to-bottom, left-to-right.
 */
export function detectFooters(page) {
	const lines = (page.lines ?? []).filter((l) => l.text.trim());
	const fronts = lines.filter((l) => isFell(l.font) && /^front$/i.test(l.text.trim()));
	const backs = lines.filter((l) => isFell(l.font) && /^back$/i.test(l.text.trim()));
	const nums = lines.filter((l) => isAvara(l.font) && /^\d{1,2}$/.test(l.text.trim()));
	const out = [];
	for (const f of fronts) {
		const y = f.bbox[1];
		const b = backs.find((bb) => Math.abs(bb.bbox[1] - y) < 6 && bb.bbox[0] > f.bbox[0] && bb.bbox[0] - f.bbox[0] < 90);
		if (!b) continue;
		const centerX = (f.bbox[0] + b.bbox[0]) / 2;
		const num = nums
			.filter((n) => Math.abs(n.bbox[1] - y) < 10 && Math.abs(n.bbox[0] - centerX) < 45)
			.sort((a, c) => Math.abs(a.bbox[0] - centerX) - Math.abs(c.bbox[0] - centerX))[0];
		out.push({ number: num ? +num.text.trim() : null, centerX, y });
	}
	return out.sort((a, b) => a.y - b.y || a.centerX - b.centerX);
}

/**
 * Resolve the footers into card regions. Footers group into rows by y; within a row, cards divide at
 * the midpoints between adjacent centers (and the page edges). Each card's content sits above its
 * footer, below the previous row's footer, split into front (left of centerX) and back (right of it).
 * Returns `[{ number, footerY, front:{x0,x1,y0,y1}, back:{…} }]`.
 */
export function cardRegions(page, footers = detectFooters(page)) {
	if (!footers.length) return [];
	const width = page.width ?? Math.max(...footers.map((f) => f.centerX)) * 2;
	const rows = [];
	for (const f of footers) {
		const row = rows.find((r) => Math.abs(r.y - f.y) < 12);
		if (row) row.cards.push(f); else rows.push({ y: f.y, cards: [f] });
	}
	rows.sort((a, b) => a.y - b.y);
	const out = [];
	let prevFooterY = TOP_MARGIN - STRIP_PAD;
	for (const row of rows) {
		const cards = [...row.cards].sort((a, b) => a.centerX - b.centerX);
		const y0 = prevFooterY + STRIP_PAD, y1 = row.y - STRIP_PAD;
		for (let i = 0; i < cards.length; i++) {
			const c = cards[i];
			const left = i === 0 ? 0 : (cards[i - 1].centerX + c.centerX) / 2;
			const right = i === cards.length - 1 ? width : (c.centerX + cards[i + 1].centerX) / 2;
			out.push({
				number: c.number,
				footerY: c.y,
				front: { x0: left, x1: c.centerX, y0, y1 },
				back: { x0: c.centerX, x1: right, y0, y1 },
			});
		}
		prevFooterY = row.y;
	}
	return out;
}

const inBox = (l, box) => { const [x, y] = l.bbox; return x >= box.x0 - 2 && x < box.x1 && y > box.y0 && y < box.y1; };

/** Carve one sub-column out of a page: its lines (Avara titles bumped to heading size), its title
 *  (topmost Avara line), and the typed blocks the shared builder produces. */
function subColumn(page, box, { rules, images }) {
	const lines = (page.lines ?? [])
		.filter((l) => l.text.trim() && inBox(l, box))
		.map((l) => (isAvara(l.font) && l.size < HEADING_SIZE ? { ...l, size: HEADING_SIZE } : l));
	// The title is the leading run of Avara lines (a long name wraps across two), ending at the first
	// body line (ACaslon). Join the run so "Runes around" + "a ruined hall" reads as one title.
	const sorted = [...lines].sort((a, b) => a.bbox[1] - b.bbox[1]);
	const titleLines = [];
	for (const l of sorted) { if (isAvara(l.font)) titleLines.push(l.text.trim()); else if (titleLines.length) break; }
	const title = titleLines.join(" ").replace(/\s{2,}/g, " ").trim() || null;
	const r = (rules ?? []).filter((d) => d.x >= box.x0 && d.x < box.x1 && d.y > box.y0 && d.y < box.y1);
	const im = (images ?? []).filter((g) => g.x >= box.x0 - 2 && g.x < box.x1 && g.y > box.y0 && g.y < box.y1);
	const blocks = linesToBlocks(lines, { rules: r, images: im, base: box.x0 });
	return { title, blocks };
}

/**
 * Extract every card on a (marker-injected) page. Returns
 * `[{ number, frontTitle, backTitle, frontBlocks, backBlocks }]` — feed the *Blocks to parseFront /
 * parseBack and pair front↔back by `number`.
 */
export function gridCards(page, { rules = [], images = [] } = {}) {
	return cardRegions(page).map((c) => {
		const front = subColumn(page, c.front, { rules, images });
		const back = subColumn(page, c.back, { rules, images });
		return {
			number: c.number,
			frontTitle: front.title,
			backTitle: back.title,
			frontBlocks: front.blocks,
			backBlocks: back.blocks,
		};
	});
}
