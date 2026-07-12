// Bring-your-own-book art extractor. Regenerates the copyrighted illustrations the compendium/sheet
// reference (but can't ship) from the books you own, into the gitignored stonetop-art/ store:
//   • Book II wonders  -> stonetop-art/wonders/<hash>.png   (content-addressed; names match refs)
//   • Book II arcana   -> stonetop-art/arcana/<slug>.png    (major-arcana front illustrations)
//   • Book I  steading -> stonetop-art/steading/<name>.png  (residents; needs Book I)
// Trade-dress marker glyphs are (re)written to the committed assets/content/wonders/markers/.
// Nothing here is committed — see stonetop-art/README.md.
//
// Usage: npm run extract-art -- /path/to/Book_II.pdf [/path/to/Book_I.pdf]
//        (or set BOOK_II_PDF / BOOK_I_PDF; both default to helper/). Book I is optional — steading
//        art is skipped when it's absent.
import { mkdirSync, mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from "fs";
import os from "os";
import path from "path";
import { loadOutline, articleRanges } from "./outline.js";
import { loadArticlePages } from "./load.js";
import { extractChrome, extractSwirls } from "./images.js";
import { extractArcanaArt } from "./arcana-art.js";
import { extractSteadingArt } from "./steading-art.js";
import { execFileSync } from "child_process";
import { toSlug } from "../../../src/utils/slug.js";

const PDF = process.argv[2] ?? process.env.BOOK_II_PDF ?? process.env.BOOK_PDF ?? "helper/Book_II_-_The_Wider_World_and_Other_Wonders.pdf";
const BOOK_I = process.argv[3] ?? process.env.BOOK_I_PDF ?? "helper/Book_I_-_Stonetop.pdf";
if (!existsSync(PDF)) {
	console.error(`! Book II PDF not found: ${PDF}\n  Usage: npm run extract-art -- /path/to/Book_II.pdf [/path/to/Book_I.pdf]`);
	process.exit(1);
}

const ASSET_DIR = "assets/content/wonders";
const DECOR_DIR = `${ASSET_DIR}/decor`;            // committed chrome (chain, rule)
const MARKERS_DIR = `${ASSET_DIR}/markers`;        // committed trade-dress marker glyphs
const UI_DECOR_DIR = "assets/ui/decor";            // committed swirl bullets
const SHARED_DIR = "stonetop-art/wonders";         // gitignored illustration store (external root)
const MARKERS = JSON.parse(readFileSync("scripts/import/pdf/trade-dress.json", "utf8")).markers;

function totalPages() {
	const out = execFileSync("mutool", ["info", PDF], { encoding: "utf8" });
	return Number((out.match(/Pages:\s*(\d+)/) || [])[1] || 302);
}

mkdirSync(MARKERS_DIR, { recursive: true });
rmSync(SHARED_DIR, { recursive: true, force: true });   // start dedup clean
mkdirSync(SHARED_DIR, { recursive: true });

// Shared chrome (same on every page).
extractChrome(PDF, DECOR_DIR);
extractSwirls(PDF, UI_DECOR_DIR);

const ranges = articleRanges(loadOutline(PDF), totalPages());
const dedup = new Map();
const scratch = mkdtempSync(path.join(os.tmpdir(), "extract-art-"));
let failed = 0;
for (const r of ranges) {
	const slug = toSlug(r.title);
	try {
		loadArticlePages(PDF, r, {
			imgDir: scratch,
			imgPrefix: slug,
			dedup: { index: dedup, dir: SHARED_DIR, markers: { dir: MARKERS_DIR, map: MARKERS } },
		});
	} catch (e) { failed++; console.warn(`! ${r.title}: ${e.message}`); }
}
rmSync(scratch, { recursive: true, force: true });

const wonders = existsSync(SHARED_DIR) ? readdirSync(SHARED_DIR).filter((f) => f.endsWith(".png")).length : 0;
console.log(`\nextracted ${wonders} wonders illustrations -> ${SHARED_DIR}/ (${dedup.size} distinct images across ${ranges.length - failed}/${ranges.length} articles)`);
console.log(`marker glyphs -> ${MARKERS_DIR}/  (trade dress, committed)`);

// Major-arcana front illustrations (Book II) -> stonetop-art/arcana/<slug>.png.
const ARCANA_DIR = "stonetop-art/arcana";
const arc = extractArcanaArt(PDF, ARCANA_DIR);
console.log(`\nextracted ${arc.written.length} major-arcana illustrations -> ${ARCANA_DIR}/` + (arc.missing.length ? `  (missing: ${arc.missing.join(", ")})` : ""));

// Steading illustrations (Book I) -> stonetop-art/steading/<name>.png. Skipped without Book I.
const STEADING_DIR = "stonetop-art/steading";
if (existsSync(BOOK_I)) {
	const st = extractSteadingArt(BOOK_I, STEADING_DIR);
	console.log(`extracted ${st.written.length} steading illustration(s) -> ${STEADING_DIR}/` + (st.missing.length ? `  (missing: ${st.missing.join(", ")})` : ""));
} else {
	console.log(`Book I not found (${BOOK_I}) — steading art skipped.`);
}
