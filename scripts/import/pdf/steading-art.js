// Extract the steading illustrations Book I embeds into the "Your home" / steading-playbook pages,
// into `stonetop-art/steading/<name>.png` — the paths the steading sheet references.
//
// Two different jobs. `residents` (the cave-art figures on the "Residents of Stonetop" page) is a
// clean standalone raster the shared `extractPageArt` pipeline can pull. The `fortunes` / `surplus`
// arch badges are not: the whole playbook page is ONE image mask, so there is no embedded raster to
// pull out and they have to be rendered and cropped — see `extractArchBadges`.
import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync } from "fs";
import os from "os";
import path from "path";
import { loadStext } from "./stext.js";
import { extractPageArt } from "./images.js";
import { InkMask, PixelRect } from "./inkMask.js";
import { whiteTransparent } from "./png.js";

/**
 * The first page in `[from, to]` carrying an Avara heading that matches `re`, or null. Used to locate
 * a named steading illustration by the section heading printed beside it.
 */
export function pageWithHeading(pdf, from, to, re, { minSize = 11 } = {}) {
	for (let p = from; p <= to; p++) {
		const page = loadStext(pdf, String(p))[0];
		if (!page) continue;
		if (page.lines.some((l) => /Avara/i.test(l.font) && l.size >= minSize && re.test(l.text.trim()))) return p;
	}
	return null;
}

/** The largest extracted image (by displayed area) at or above `minW` points, or null. */
export function largestIllustration(images, { minW = 100 } = {}) {
	let best = null;
	for (const im of images ?? []) {
		if ((im.w ?? 0) < minW) continue;
		if (!best || im.w * im.h > best.w * best.h) best = im;
	}
	return best;
}

/**
 * Extract the steading illustrations from `pdf` (Book I) into `outDir/<name>.png`. Returns
 * `{ written:[name], missing:[name] }`. `range` bounds the search for the steading-playbook pages.
 */
export function extractSteadingArt(pdf, outDir, { range = [72, 86] } = {}) {
	mkdirSync(outDir, { recursive: true });
	const written = [], missing = [];
	const residentsPage = pageWithHeading(pdf, range[0], range[1], /^Residents of Stonetop$/i);
	if (residentsPage) {
		const tmp = mkdtempSync(path.join(os.tmpdir(), "steading-art-"));
		try {
			const img = largestIllustration(extractPageArt(pdf, residentsPage, tmp, "residents"));
			if (img) { copyFileSync(img.file, path.join(outDir, "residents.png")); written.push("residents"); }
			else missing.push("residents");
		} finally { rmSync(tmp, { recursive: true, force: true }); }
	} else missing.push("residents");
	return { written, missing };
}

// ── The arch badges ────────────────────────────────────────────────────────────────────────────
//
// The book crowns Fortunes and Surplus with an ARCH — an illustration under a semicircular crown,
// closed by a solid inked band, with the rating's name printed beneath it. The other four ratings get
// a plain rule. That is a hierarchy the book prints, and the sheet keeps it.
//
// The WHOLE PANEL is extracted: outline, illustration, and the distressed band at its foot.
//
// It used to be the illustration only, inset far enough to clear the printed outline so the sheet
// could draw its own arch around it. That was the thing costing more than it bought. A rectangular
// crop can never clear a CURVED shoulder, so the book's own stroke came along anyway and sat offset
// inside the one we drew; and the inset clipped, because Fortunes bleeds to its outline in the book
// — cutting inside the stroke cut the sun's rays off, while Surplus, which doesn't bleed, kept a
// white margin. Both defects only existed because we were trying to leave the outline behind.
//
// The objection to lifting the panel was that it is "a slab of 1-bit ink several times the weight of
// anything near it". The ratio is real — a 3.3px stroke against 1px rules — but it reads as an arch,
// not a slab, and the comparison runs the other way: the book's band is broken and distressed, while
// the plinth we drew was a flat solid rectangle, the heavier and deader of the two at any size.
//
// Taking the whole panel, the crop is one rectangle between landmarks the code already finds:
// outermost ink at the sides, the crown at the top, the foot of the band at the bottom.

/** One arch panel, named by the rating it crowns and by the word printed under it. */
export class ArchBadge {
	constructor(slug, label) {
		this.slug = slug;
		this.label = label;
	}
}

export const ARCH_BADGES = [new ArchBadge("fortunes", "Fortunes"), new ArchBadge("surplus", "Surplus")];

// Measurement is cheap and only has to be reliable; the badge itself wants the resolution.
const ANALYSIS_DPI = 300;
const BADGE_DPI    = 600;

// A window this much wider than the printed word, to either side. The arches are barely wider than
// their own labels (~4 pt), and the gap between the two panels is ~11 pt, so this reaches the whole
// arch without ever reaching its neighbour.
const WINDOW_PAD_PT = 8;
// The base band is nearly solid across the arch; nothing else in the window comes close.
const BAND_INK = 0.5;
// A blank run this tall separates the arch from the masthead above it.
const ARCH_GAP_PT = 8;
// Ink this sparse is still the arch — its crown is a thin stroke a few pixels wide.
const ARCH_INK = 0.004;

/** The page in `[from, to]` whose Avara lines print every one of `labels`, or null. */
export function pageWithLabels(pdf, from, to, labels) {
	for (let p = from; p <= to; p++) {
		const page = loadStext(pdf, String(p))[0];
		if (!page) continue;
		const found = new Map();
		for (const line of page.lines) {
			if (!/Avara/i.test(line.font)) continue;
			const text = line.text.trim();
			if (labels.includes(text)) found.set(text, line);
		}
		if (labels.every(l => found.has(l))) return { page: p, lines: found };
	}
	return null;
}

/**
 * The whole arch panel printed above `labelBox`, measured off `mask`.
 *
 * Worked from the label upward, because the label is the one landmark that can be located exactly —
 * the text layer gives its box. Above it: the band is the first mostly-inked run, and the crown is
 * the topmost ink before a clear gap. The panel is what those bracket, side to side at the band's
 * own extent. Nothing here is a remembered coordinate.
 *
 * The band is what says where the SIDES are, not the illustration: it spans the panel's full width
 * at a constant one, while the drawing above it is ragged and Fortunes' rays reach further than
 * Surplus' granary does.
 *
 * `ppp` is pixels per point in `mask`. Returns a PixelRect, or null where the page has no arch
 * above that label.
 */
export function archPanelAbove(mask, labelBox, ppp) {
	const [x0, y0] = labelBox;
	const left  = Math.max(0, Math.round((x0 - WINDOW_PAD_PT) * ppp));
	const right = Math.min(mask.width - 1, Math.round((labelBox[2] + WINDOW_PAD_PT) * ppp));

	const band = mask.solidRunAbove(Math.round(y0 * ppp) - 1, left, right, BAND_INK);
	if (!band) return null;

	const crown = mask.inkTopAbove(band.top - 1, left, right, { gap: ARCH_GAP_PT * ppp, minInk: ARCH_INK });
	if (crown === null) return null;

	const extent = mask.rowInkExtent(Math.round((band.top + band.bottom) / 2), left, right);
	if (!extent) return null;

	// Crown to the FOOT of the band, edge to edge: the panel as the book prints it.
	const panel = new PixelRect(extent[0], crown, extent[1], band.bottom);
	return panel.width > 0 && panel.height > 0 ? panel : null;
}

/**
 * Extract the Fortunes and Surplus arch panels from `pdf` (Book I) into `outDir/<slug>.png`, as
 * black-on-transparent so the sheet can tone them to whichever parchment it is on.
 *
 * Soft alpha, not a 1-bit threshold: coverage comes from the grayscale render's own darkness
 * (`whiteTransparent`), which is what lets a 600dpi woodcut survive the ~5x downscale to the size it
 * is actually drawn at. Thresholded first, the crown's thin stroke breaks up on the way down.
 *
 * Returns `{ written:[slug], missing:[slug] }`.
 */
export function extractArchBadges(pdf, outDir, { range = [72, 86] } = {}) {
	mkdirSync(outDir, { recursive: true });
	const written = [], missing = [];
	const labels = ARCH_BADGES.map(b => b.label);
	const found = pageWithLabels(pdf, range[0], range[1], labels);
	if (!found) return { written, missing: ARCH_BADGES.map(b => b.slug) };

	const tmp = mkdtempSync(path.join(os.tmpdir(), "arch-badges-"));
	try {
		const mask = InkMask.fromPng(readFileSync(renderPage(pdf, found.page, ANALYSIS_DPI, tmp, "page", ["-gray"])));
		for (const badge of ARCH_BADGES) {
			const rect = archPanelAbove(mask, found.lines.get(badge.label).bbox, ANALYSIS_DPI / 72);
			if (!rect) { missing.push(badge.slug); continue; }
			const crop = rect.scaled(BADGE_DPI / ANALYSIS_DPI);
			const png = renderPage(pdf, found.page, BADGE_DPI, tmp, badge.slug, [
				"-x", String(crop.x0), "-y", String(crop.y0), "-W", String(crop.width), "-H", String(crop.height),
			]);
			writeFileSync(path.join(outDir, `${badge.slug}.png`), whiteTransparent(readFileSync(png)));
			written.push(badge.slug);
		}
	} finally { rmSync(tmp, { recursive: true, force: true }); }
	return { written, missing };
}

/** Render one page (optionally one crop of it) to PNG in `dir`, and return the file written. */
function renderPage(pdf, page, dpi, dir, name, args = []) {
	const prefix = path.join(dir, name);
	execFileSync("pdftoppm", ["-png", "-r", String(dpi), "-f", String(page), "-l", String(page), ...args, pdf, prefix]);
	const file = readdirSync(dir).find(f => f.startsWith(`${name}-`));
	return path.join(dir, file);
}

// The four season glyphs the Seasons Change move is bulleted with, in the book's own reading order.
export const SEASONS = ["spring", "summer", "autumn", "winter"];

/**
 * Extract the Seasons Change spread's art from `pdf` (Book I). Two destinations, because the two
 * kinds of image have different rights: the four small season glyphs are trade dress and ship in
 * `iconsDir` (committed), while the harvest illustration beside them is a copyrighted plate and goes
 * to `artDir` (the gitignored store, same as every other illustration).
 *
 * The page is found by its Avara "Seasonal gains" panel heading rather than a page number — the
 * move's own "SEASONS CHANGE" title is body-font, and page numbers shift between printings.
 *
 * Returns `{ written:[name], missing:[name] }`.
 */
export function extractSeasonsArt(pdf, { artDir, iconsDir, range = [38, 48] } = {}) {
	mkdirSync(artDir,   { recursive: true });
	mkdirSync(iconsDir, { recursive: true });
	const written = [], missing = [];
	const page = pageWithHeading(pdf, range[0], range[1], /^Seasonal gains$/i);
	if (!page) return { written, missing: ["seasons", ...SEASONS.map(s => `season-${s}`)] };

	const tmp = mkdtempSync(path.join(os.tmpdir(), "seasons-art-"));
	try {
		const arts = extractPageArt(pdf, page, tmp, "seasons", { minW: 20, minH: 20 });

		// The glyphs are small squares. Column-major (x, then y) is the order they are read in: three
		// down the first column, then winter atop the second.
		const icons = arts
			.filter(a => a.w <= 60 && Math.abs(a.w - a.h) <= 2)
			.sort((a, b) => a.x - b.x || a.y - b.y);
		SEASONS.forEach((season, i) => {
			const icon = icons[i];
			if (icon) { copyFileSync(icon.file, path.join(iconsDir, `season-${season}.png`)); written.push(`season-${season}`); }
			else missing.push(`season-${season}`);
		});

		// `box` marks a thin frame (the gains panel's rule), not a plate — exclude it before picking
		// the largest, or the frame wins on area.
		const plate = largestIllustration(arts.filter(a => !a.box), { minW: 100 });
		if (plate) { copyFileSync(plate.file, path.join(artDir, "seasons.png")); written.push("seasons"); }
		else missing.push("seasons");
	} finally { rmSync(tmp, { recursive: true, force: true }); }
	return { written, missing };
}
