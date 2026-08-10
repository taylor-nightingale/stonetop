// Extract the steading illustrations Book I embeds into the "Your home" / steading-playbook pages,
// into `stonetop-art/steading/<name>.png` — the paths the steading sheet references. Only `residents`
// (the cave-art figures on the "Residents of Stonetop" page) is a clean standalone raster the shared
// `extractPageArt` pipeline can pull; the `fortunes` / `surplus` badges are baked into the page-frame
// composite and would need a render-and-crop pass (they are also currently unreferenced by the sheet).
import { mkdtempSync, rmSync, mkdirSync, copyFileSync } from "fs";
import os from "os";
import path from "path";
import { loadStext } from "./stext.js";
import { extractPageArt } from "./images.js";

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
