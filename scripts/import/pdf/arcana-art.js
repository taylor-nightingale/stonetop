// Extract each major arcanum's front-card illustration from Book II's "APPENDIX D: Major Arcana"
// and write it to `stonetop-art/arcana/<slug>.png` — the path the arcana pack already references.
// The illustrations are embedded 1-bit stencils (the same kind as the wonders art), so the shared
// `extractPageArt` pipeline pulls + normalizes them to black-on-transparent; here we only associate
// each extracted illustration with its arcanum (by the name heading that precedes it) and persist it
// under the arcanum's slug. No content-addressing: each major arcanum has a unique illustration, so a
// stable slug name is simpler than a hash and needs no pack-ref changes.
import { mkdtempSync, rmSync, mkdirSync, readdirSync, readFileSync, copyFileSync } from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { loadOutline, arcanaAppendixRanges } from "./outline.js";
import { loadArticlePages } from "./load.js";

export const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Load the major-arcana roster from the pack sources: `norm(name) -> slug`. */
export function majorArcanaRoster(dir = "packs/src/arcana/major") {
	const byName = new Map();
	for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
		const doc = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
		byName.set(norm(doc.name), doc.system.slug);
	}
	return byName;
}

/**
 * The major arcanum whose front-card title is printed on this page, or null. Each card's name is a
 * large Avara heading; try each heading (allowing a name that wraps onto the next 1–2 heading lines)
 * against the roster. The running header and "Mysteries of X" back-titles are also Avara but never
 * match a roster name, so they're ignored for free.
 */
export function arcanumOnPage(page, byName, { minSize = 11 } = {}) {
	const heads = page.lines
		.filter((l) => /Avara/i.test(l.font) && l.size >= minSize && l.text.trim())
		.sort((a, b) => a.bbox[1] - b.bbox[1]);
	for (let i = 0; i < heads.length; i++) {
		let raw = heads[i].text;
		for (let k = 0; k <= 2; k++) {
			if (byName.has(norm(raw))) return byName.get(norm(raw));
			raw += " " + (heads[i + 1 + k]?.text ?? "");
		}
	}
	return null;
}

/**
 * The front illustration among a page's extracted images: the largest by displayed area at or above
 * `minW` points (excludes the ~18pt creature markers and the small ~85pt inset badges). Box-flagged
 * images are *included* — sparse line-art illustrations get mis-flagged as hollow frames by the
 * extractor's ink-fraction heuristic, and the front card carries no genuine box frame. Returns the
 * image object (with `.file`) or null.
 */
export function pickPageIllustration(images, { minW = 60 } = {}) {
	let best = null;
	for (const im of images ?? []) {
		if ((im.w ?? 0) < minW) continue;
		if (!best || im.w * im.h > best.w * best.h) best = im;
	}
	return best;
}

/**
 * Extract the major-arcana front illustrations from `pdf` (Book II) into `outDir/<slug>.png` — the
 * path the arcana pack already references. Works page-by-page off the raw `pageImages` (which retain
 * every extracted file, including the box-mis-flagged sparse illustrations). Returns
 * `{ written:[slug], missing:[slug] }` for the caller to report.
 */
export function extractArcanaArt(pdf, outDir, { roster = majorArcanaRoster() } = {}) {
	const total = Number((execFileSync("mutool", ["info", pdf], { encoding: "utf8" }).match(/Pages:\s*(\d+)/) || [])[1] || 302);
	const ranges = arcanaAppendixRanges(loadOutline(pdf), total).filter((r) => r.tier === "major");
	mkdirSync(outDir, { recursive: true });
	const found = new Map();
	for (const r of ranges) {
		const tmp = mkdtempSync(path.join(os.tmpdir(), "arc-art-"));
		try {
			const { pages, pageImages } = loadArticlePages(pdf, r, { imgDir: tmp, imgPrefix: "arc" });
			pages.forEach((page, i) => {
				const slug = arcanumOnPage(page, roster);
				if (!slug || found.has(slug)) return;
				const img = pickPageIllustration(pageImages[i]);
				if (img) { copyFileSync(img.file, path.join(outDir, `${slug}.png`)); found.set(slug, img); }
			});
		} finally { rmSync(tmp, { recursive: true, force: true }); }
	}
	return { written: [...found.keys()], missing: [...roster.values()].filter((s) => !found.has(s)) };
}
