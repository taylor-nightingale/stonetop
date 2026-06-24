import { execFileSync } from "child_process";

/**
 * The book's section dividers live in the vector/image layer, not the text, so they come from
 * `mutool trace`. Two kinds, both placed by a transform `[a b c d e f]` in the same page
 * coordinate space as stext:
 *   • "line"  — a black `<stroke_path>` with one horizontal segment (thin rule under headings /
 *               between sub-sections). We keep full-column-width ones; narrower strokes are
 *               table-internal.
 *   • "braid" — a `<fill_image_mask>` ~651px wide (the braided rule that sits above a column-top
 *               section). The wide ~1350px chain band above the title is handled separately.
 */
export function parseDividers(xml, { minLineWidth = 140 } = {}) {
	const out = [];

	const sre = /<stroke_path ([^>]*)>([\s\S]*?)<\/stroke_path>/g;
	let m;
	while ((m = sre.exec(xml))) {
		const [attrs, body] = [m[1], m[2]];
		if (!/color="0 0 0"/.test(attrs)) continue;
		const t = (attrs.match(/transform="([^"]*)"/) || [])[1];
		if (!t) continue;
		const [, , , , e, f] = t.split(/\s+/).map(Number);
		const pts = [...body.matchAll(/<(?:move|line)to x="([-\d.]+)" y="([-\d.]+)"/g)].map((p) => [+p[1], +p[2]]);
		if (pts.length < 2 || new Set(pts.map((p) => Math.round(p[1]))).size !== 1) continue;
		const width = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
		if (width >= minLineWidth) out.push({ x: e, y: f, width: Math.round(width), kind: "line" });
	}

	const ire = /<fill_image_mask transform="([^"]*)"[^>]*width="(\d+)"\s+height="(\d+)"/g;
	while ((m = ire.exec(xml))) {
		const [a, , , , e, f] = m[1].split(/\s+/).map(Number);
		if (Number(m[2]) >= 600 && Number(m[2]) <= 700 && Number(m[3]) <= 20) {
			out.push({ x: e, y: f, width: Math.round(Math.abs(a)), kind: "braid" });
		}
	}
	return out;
}

/** Run `mutool trace` for a page and return its divider positions (lines + braids). */
export function loadDividers(pdfPath, page) {
	return parseDividers(execFileSync("mutool", ["trace", pdfPath, String(page)], { encoding: "utf8", maxBuffer: 1 << 26 }));
}

/** Area of the convex hull of a set of points (used to tell a circle from a diamond). */
function hullArea(pts) {
	const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const lo = []; for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
	const up = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
	const h = lo.slice(0, -1).concat(up.slice(0, -1));
	let a = 0; for (let i = 0; i < h.length; i++) { const j = (i + 1) % h.length; a += h[i][0] * h[j][1] - h[j][0] * h[i][1]; }
	return Math.abs(a) / 2;
}

/**
 * Small check markers from the vector layer: the resource **circle** ○ and the outfit **diamond**
 * ◇. Both are drawn as small unfilled curved outlines (`stroke_path`, ≥3 arcs, no straight sides),
 * so they're told apart by how much of their bounding box the shape fills (including curve control
 * points): a circle ≈ 0.9, a diamond ≈ 0.5. Everything else — filled swirls and the
 * swirl+triangle/arrow list bullets — is left alone (the lists detect themselves).
 * Returns `[{x, y, w, h, kind}]` in page coordinates.
 */
export function parseMarkers(xml) {
	const out = [];
	const re = /<stroke_path ([^>]*)>([\s\S]*?)<\/stroke_path>/g;
	let m;
	while ((m = re.exec(xml))) {
		const body = m[2];
		if (!/color="0 0 0"/.test(m[1]) || /lineto/.test(body) || (body.match(/curveto/g) || []).length < 3) continue;
		const t = m[1].match(/transform="1 0 0 -1 ([-\d.]+) ([-\d.]+)"/);
		if (!t) continue;
		const pts = [...body.matchAll(/x\d?="([-\d.]+)"\s+y\d?="([-\d.]+)"/g)].map((p) => [+p[1], +p[2]]);
		const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
		const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
		if (w < 2 || w >= 16 || h >= 16) continue;
		out.push({ x: +t[1], y: +t[2], w, h, kind: hullArea(pts) / (w * h) < 0.7 ? "diamond" : "circle" });
	}
	return out;
}

/** Run `mutool trace` for a page and return its check-marker positions. */
export function loadMarkers(pdfPath, page) {
	return parseMarkers(execFileSync("mutool", ["trace", pdfPath, String(page)], { encoding: "utf8", maxBuffer: 1 << 26 }));
}

/**
 * List-bullet swirls from the vector layer: a filled spiral (`fill_path`, many curves). A "pointing"
 * swirl additionally has a small filled arrow/triangle (straight-sided fill) right beside it; a
 * plain one doesn't. Returns `[{x, y, w, h, kind}]` (kind: "bullet" | "point").
 */
export function parseBullets(xml) {
	const swirls = [], arrows = [];
	const re = /<fill_path ([^>]*)>([\s\S]*?)<\/fill_path>/g;
	let m;
	while ((m = re.exec(xml))) {
		if (!/color="0 0 0"/.test(m[1])) continue;
		const t = m[1].match(/transform="1 0 0 -1 ([-\d.]+) ([-\d.]+)"/);
		if (!t) continue;
		const pts = [...m[2].matchAll(/x\d?="([-\d.]+)"\s+y\d?="([-\d.]+)"/g)].map((p) => [+p[1], +p[2]]);
		if (pts.length < 2) continue;
		const w = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
		const h = Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));
		if (w < 2 || w >= 16 || h >= 16) continue;
		const e = +t[1], f = +t[2];
		// page bbox (transform is "1 0 0 -1 e f": page = (e+lx, f-ly))
		const box = { x0: e + Math.min(...pts.map((p) => p[0])), x1: e + Math.max(...pts.map((p) => p[0])), y0: f - Math.max(...pts.map((p) => p[1])), y1: f - Math.min(...pts.map((p) => p[1])) };
		const curves = (m[2].match(/curveto/g) || []).length, lines = (m[2].match(/lineto/g) || []).length;
		if (curves > 10 && lines === 0) swirls.push({ x: e, y: f, w, h, box });           // the spiral
		else if (curves === 0 && lines >= 3) arrows.push({ x: e, y: f, box });            // the arrow/triangle
	}
	return swirls.map((s) => {
		const arrow = arrows.find((a) => Math.abs(a.x - s.x) < 14 && Math.abs(a.y - s.y) < 8);
		const box = arrow
			? { x0: Math.min(s.box.x0, arrow.box.x0), y0: Math.min(s.box.y0, arrow.box.y0), x1: Math.max(s.box.x1, arrow.box.x1), y1: Math.max(s.box.y1, arrow.box.y1) }
			: s.box;
		return { ...s, box, kind: arrow ? "point" : "bullet" };
	});
}

/** Run `mutool trace` for a page and return its list-bullet swirl positions. */
export function loadBullets(pdfPath, page) {
	return parseBullets(execFileSync("mutool", ["trace", pdfPath, String(page)], { encoding: "utf8", maxBuffer: 1 << 26 }));
}
