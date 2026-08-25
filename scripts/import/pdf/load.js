import { loadStext } from "./stext.js";
import { loadDividers, loadMarkers, loadBullets } from "./rules.js";
import { extractPageArt } from "./images.js";

// Shared per-article page loader: turns an outline range into the `{ pages, pageRules, pageImages }`
// that `extractArticle` consumes — stext lines with the swirl/marker glyphs injected, vector
// dividers, and extracted illustrations, with boundary spreads cropped to the right half. Used by
// both the HTML preview (dump-article.js) and the npc pack build (build-npcs.js) so they see the
// exact same structure.

/** Splice a marker glyph into `line` at the character whose x is at/right of `x` — the glyph joins
 *  the surrounding TEXT span (not a "marker" span), so the markdown pass keeps it, exactly like the
 *  book keeps its inline item-weight diamonds. The glyph's x is recorded in the span's `xs` so a
 *  second marker on the same line lands after it ("◇◇"). Returns false when every character sits
 *  left of `x` (nothing to splice before) — the caller falls back to a pseudo-line. */
export function spliceGlyph(line, x, g) {
	for (const s of line.spans) {
		if (!s.xs) continue;
		for (let i = 0; i < s.text.length; i++) {
			if (s.xs[i] >= x) {
				s.text = s.text.slice(0, i) + g + s.text.slice(i);
				s.xs.splice(i, 0, x);
				line.text = line.spans.map((sp) => sp.text).join("");
				return true;
			}
		}
	}
	return false;
}

// Drop the resource/outfit check markers (small vector circles/diamonds) inline as glyphs.
// Align each to the text line it overlaps and merge it into that row; ordering by x then
// places it. Match by the nearest vertical centre (a marker sits between two rows, so the
// closest baseline wins, not the closest left-edge). A diamond either leads its item (a
// bullet) or sits inline within a sentence as an item-weight marker ("Retrieve an ◇◇ acorn",
// "A ◇ sack full of rhoillyg seeds") — an inline diamond that falls INSIDE a line's span is
// spliced into the text at its exact character position (a pseudo-line can only sort between
// mutool cells, which put it at the wrong spot). Circles can be inline (potency dots inside
// "(○○○ uses)"), so they keep the wider match.
//
// Pure over `markers`, so a caller can supply its own — Book I's articles pass the page's marks
// minus any belonging to a figure, because the sample insert printed on "Gear and possessions"
// carries 117 of its own that would otherwise scatter through the prose around it.
export function attachMarkers(pg, markers) {
	for (const mk of markers) {
		const mid = (l) => (l.bbox[1] + l.bbox[3]) / 2;
		let line;
		if (mk.kind === "square") {
			// A square checkbox's origin (mk.y) sits at the *top* of its (item-first) line — so it
			// must attach there by line-top proximity, not line-center, or a 2-line wrapped item gets
			// the box on its second line and is split. Only leading lines (starting at/right of it).
			const cand = pg.lines.filter((l) => l.font !== "marker" && l.text.trim() && l.bbox[0] >= mk.x - 2 && Math.abs(l.bbox[1] - mk.y) < 8);
			line = cand.sort((a, b) => Math.abs(a.bbox[1] - mk.y) - Math.abs(b.bbox[1] - mk.y))[0];
		} else {
			// Circle ○ / diamond ◇: match by vertical center. A diamond either leads its line (the
			// text starts just right of it) or sits inline within it (the line spans across its x) —
			// both are column-local, so a nearer-centred line in the neighbouring column never wins.
			// A circle can be inline anywhere on the row ("(○○○ uses)"), so it keeps the wider match.
			const cy = mk.y - mk.h / 2;
			const cand = pg.lines.filter((l) => l.font !== "marker" && l.text.trim() && l.bbox[1] - 3 <= cy && l.bbox[3] + 3 >= cy && Math.abs(l.bbox[0] - mk.x) < 200);
			const pool = mk.kind === "diamond"
				? cand.filter((l) => (l.bbox[0] >= mk.x - 2 && l.bbox[0] < mk.x + 60) || (l.bbox[0] <= mk.x && mk.x <= l.bbox[2]))
				: cand;
			line = (mk.kind === "diamond" ? pool : (pool.length ? pool : cand)).sort((a, b) => Math.abs(mid(a) - cy) - Math.abs(mid(b) - cy))[0];
		}
		const y0 = line ? line.bbox[1] : mk.y;
		const g = mk.kind === "circle" ? "○" : mk.kind === "square" ? "□" : "◇";
		// Splice a mark that falls inside a line at its exact character position — circles as well as
		// diamonds. A pseudo-line can only sort by its x against the line's LEFT edge, so a circle
		// sitting within a cell lands outside it entirely: "(○ plenty left, low ammo, all out ○ ○)"
		// instead of "(○ plenty left, ○ low ammo, ○ all out)". Splicing also keeps a run together,
		// since the glyphs join one span rather than becoming separate lines joined with spaces.
		if (mk.kind !== "square" && line && mk.x > line.bbox[0] + 1 && spliceGlyph(line, mk.x, g)) continue;
		pg.lines.push({ bbox: [mk.x, y0, mk.x + mk.w, y0 + 8], text: g, font: "marker", size: 7, spans: [{ font: "marker", size: 7, text: g }] });
	}
	return pg;
}

/** Position of an article title (largest Avara line) on a page, to detect spreads shared by two
 *  articles (one printed page each). */
export function titleHalf(pdf, pdfPage) {
	const p = loadStext(pdf, String(pdfPage))[0];
	if (!p) return null;
	const big = p.lines.filter((l) => /Avara/i.test(l.font) && l.size >= 16).sort((a, b) => b.size - a.size)[0];
	return big ? { x: big.bbox[0], mid: p.width / 2 } : null;
}

/** Resolve an article's actual page span, accounting for boundary spreads it shares with a
 *  neighbour (one printed page each). */
export function articleBoundaries(pdf, r) {
	const startT = titleHalf(pdf, r.pdfPage);
	const startRight = !!(startT && startT.x >= startT.mid);
	let endPage = r.endPage, endLeft = false;
	const nextT = titleHalf(pdf, r.endPage + 1);
	if (nextT && nextT.x >= nextT.mid) { endPage = r.endPage + 1; endLeft = true; }
	return { startPage: r.pdfPage, endPage, startRight, endLeft };
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.markers=true] Splice the vector ◇/○/□ marks into the text.
 *   Book II draws its inline load diamonds as vector art, so it needs this. Book I does NOT — it
 *   sets them as font glyphs (see glyphs.js), and its vector marks belong to FIGURES: the sample
 *   inventory insert printed on "Gear and possessions" carries 117 of them, which this would scatter
 *   through the prose around it. Book I therefore loads with markers off.
 */
export function loadArticlePages(pdf, r, { imgDir, imgPrefix = "art", mapFile = (f) => f, dedup, markers = true } = {}) {
	const { startPage, endPage, startRight, endLeft } = articleBoundaries(pdf, r);
	const pages = [], pageRules = [], pageImages = [];
	for (let p = startPage; p <= endPage; p++) {
		const pg = loadStext(pdf, String(p))[0];
		// Tag each list item with its swirl bullet (plain spiral vs pointing) via a marker span.
		for (const sw of loadBullets(pdf, p)) {
			const cy = sw.y - sw.h / 2;
			// The bullet sits just left of its item's text — match a line whose left edge is right at
			// (or just right of) the swirl, in the same row. A wide tolerance cross-matches columns.
			const line = pg.lines
				.filter((l) => !/^(marker|swirl)/.test(l.font) && l.text.trim() && l.bbox[1] - 3 <= cy && l.bbox[3] + 3 >= cy && l.bbox[0] >= sw.x - 6 && l.bbox[0] < sw.x + 45)
				.sort((a, b) => a.bbox[0] - b.bbox[0])[0];
			if (!line) continue;
			const y0 = line.bbox[1];
			const font = sw.kind === "point" ? "swirl-point" : "swirl";
			pg.lines.push({ bbox: [sw.x - 3, y0, sw.x, y0 + 8], text: "", font, size: 7, spans: [{ font, size: 7, text: "" }] });
		}
		attachMarkers(pg, markers ? loadMarkers(pdf, p) : []);
		let rules = loadDividers(pdf, p);
		let imgs = extractPageArt(pdf, p, imgDir, `${imgPrefix}-p${p}`, { dedup }).map((im) => ({ ...im, file: mapFile(im.file) }));
		const mid = pg.width / 2;
		if (p === startPage && startRight) { pg.lines = pg.lines.filter((l) => l.bbox[0] >= mid); rules = rules.filter((x) => x.x >= mid); imgs = imgs.filter((im) => im.x >= mid); }
		if (p === endPage && endLeft) { pg.lines = pg.lines.filter((l) => l.bbox[0] < mid); rules = rules.filter((x) => x.x < mid); imgs = imgs.filter((im) => im.x < mid); }
		pages.push(pg); pageRules.push(rules); pageImages.push(imgs);
	}
	return { pages, pageRules, pageImages, startPage, endPage };
}
