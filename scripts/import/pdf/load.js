import { loadStext } from "./stext.js";
import { loadDividers, loadMarkers, loadBullets } from "./rules.js";
import { extractPageArt } from "./images.js";

// Shared per-article page loader: turns an outline range into the `{ pages, pageRules, pageImages }`
// that `extractArticle` consumes — stext lines with the swirl/marker glyphs injected, vector
// dividers, and extracted illustrations, with boundary spreads cropped to the right half. Used by
// both the HTML preview (dump-article.js) and the npc pack build (build-npcs.js) so they see the
// exact same structure.

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

export function loadArticlePages(pdf, r, { imgDir, imgPrefix = "art", mapFile = (f) => f, dedup } = {}) {
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
		// Drop the resource/outfit check markers (small vector circles/diamonds) inline as glyphs.
		// Align each to the text line it overlaps and merge it into that row; ordering by x then
		// places it. Match by the nearest vertical centre (a marker sits between two rows, so the
		// closest baseline wins, not the closest left-edge). A diamond is always a *leading* bullet —
		// it precedes its item and never sits at a line's end — so it only attaches to a line that
		// starts at/right of it. Circles can be inline (potency dots inside "(○○○ uses)"), so they
		// keep the wider match.
		for (const mk of loadMarkers(pdf, p)) {
			const cy = mk.y - mk.h / 2;
			const mid = (l) => (l.bbox[1] + l.bbox[3]) / 2;
			const cand = pg.lines.filter((l) => l.font !== "marker" && l.text.trim() && l.bbox[1] - 3 <= cy && l.bbox[3] + 3 >= cy && Math.abs(l.bbox[0] - mk.x) < 200);
			const pool = mk.kind === "diamond" ? cand.filter((l) => l.bbox[0] >= mk.x - 2) : cand;
			const line = (pool.length ? pool : cand).sort((a, b) => Math.abs(mid(a) - cy) - Math.abs(mid(b) - cy))[0];
			const y0 = line ? line.bbox[1] : mk.y - mk.h;
			const g = mk.kind === "circle" ? "○" : "◇";
			pg.lines.push({ bbox: [mk.x, y0, mk.x + mk.w, y0 + 8], text: g, font: "marker", size: 7, spans: [{ font: "marker", size: 7, text: g }] });
		}
		let rules = loadDividers(pdf, p);
		let imgs = extractPageArt(pdf, p, imgDir, `${imgPrefix}-p${p}`, { dedup }).map((im) => ({ ...im, file: mapFile(im.file) }));
		const mid = pg.width / 2;
		if (p === startPage && startRight) { pg.lines = pg.lines.filter((l) => l.bbox[0] >= mid); rules = rules.filter((x) => x.x >= mid); imgs = imgs.filter((im) => im.x >= mid); }
		if (p === endPage && endLeft) { pg.lines = pg.lines.filter((l) => l.bbox[0] < mid); rules = rules.filter((x) => x.x < mid); imgs = imgs.filter((im) => im.x < mid); }
		pages.push(pg); pageRules.push(rules); pageImages.push(imgs);
	}
	return { pages, pageRules, pageImages, startPage, endPage };
}
