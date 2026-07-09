// Build the Book II wonder-improvement items from the "Steading improvement" call-out boxes the book
// embeds in its wonder articles (e.g. Barrier Pass's "Trade with Barrier Pass"). Each box is parsed
// (improvements.js) into the same choice-group shape as the hand-authored Stonetop-core improvements
// and written as one `improvement` Item to packs/src/steading-improvements/additional/<slug>.json.
//
//   node scripts/import/pdf/build-improvements.js            # rebuild the whole additional/ folder
//   node scripts/import/pdf/build-improvements.js "Barrier Pass" ...   # only the listed articles
//
// This script owns the steading-improvements/additional/ source folder outright: a full rebuild clears
// it and regenerates, exactly like build-journal owns its journal pack. The hand-authored Stonetop-core
// improvements live in the sibling stonetop/ folder of the same pack and are never touched here. IDs are
// deterministic (improvementUuid), so the journal build links to these items without this script having
// run first. A review summary is written for spot-checking.
import os from "os"; import path from "path";
import { mkdtempSync, rmSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { loadOutline, articleRanges } from "./outline.js";
import { loadArticlePages } from "./load.js";
import { extractArticle } from "./layout.js";
import { formatPageRange } from "./pages.js";
import { extractImprovements, improvementUuid, IMPROVEMENTS_PACK } from "./improvements.js";
import { deterministicId, documentKey } from "../ids.js";

const PDF = process.env.BOOK_PDF ?? "helper/Book_II_-_The_Wider_World_and_Other_Wonders.pdf";
const OUT = `packs/src/${IMPROVEMENTS_PACK}/additional`;
const REVIEW = "helper/wonder-improvement-review.md";

const totalPages = () => Number((execFileSync("mutool", ["info", PDF], { encoding: "utf8" }).match(/Pages:\s*(\d+)/) || [])[1] || 302);

const ranges = articleRanges(loadOutline(PDF), totalPages());
const byTitle = Object.fromEntries(ranges.map((r) => [r.title.toLowerCase(), r]));
const wanted = process.argv.slice(2);
const build = wanted.length ? wanted.map((t) => byTitle[t.toLowerCase()]).filter(Boolean) : ranges;
for (const t of wanted) if (!byTitle[t.toLowerCase()]) console.warn(`! no article titled ${JSON.stringify(t)}`);

mkdirSync(OUT, { recursive: true });
if (!wanted.length) for (const f of readdirSync(OUT).filter((n) => n.endsWith(".json"))) rmSync(path.join(OUT, f)); // full rebuild

const scratch = mkdtempSync(path.join(os.tmpdir(), "improvements-"));
const flags = [];
const rows = []; // review lines
let sortOrder = 0, written = 0;

for (const r of build) {
	let art;
	try {
		const { pages, pageRules, pageImages } = loadArticlePages(PDF, r, { imgDir: scratch, imgPrefix: "imp" });
		art = extractArticle(pages, { title: r.title, pageRules, pageImages });
	} catch (e) { flags.push(`! ${r.title}: extract failed — ${e.message}`); continue; }

	const page = formatPageRange(art.pageNumbers);
	for (const imp of extractImprovements(art)) {
		const picks = imp.choices.list.filter((row) => row.track);
		if (!picks.length) flags.push(`? ${r.title}: "${imp.name}" parsed no requirement rows — check the box`);
		const id = deterministicId(IMPROVEMENTS_PACK, imp.slug);
		const doc = {
			name: imp.name,
			type: "improvement",
			flags: {},
			_id: id,
			_key: documentKey("Item", id),
			system: { slug: imp.slug, sortOrder: ++sortOrder, choices: imp.choices },
		};
		writeFileSync(path.join(OUT, `${imp.slug}.json`), JSON.stringify(doc, null, "\t") + "\n");
		written++;
		rows.push(`- **${imp.name}** — ${r.title} (Book p.${page}) — ${picks.length} requirement(s) [${picks.map((p) => p.track.max).join(", ")}] → ${improvementUuid(imp.slug)}`);
	}
}
rmSync(scratch, { recursive: true, force: true });

writeFileSync(REVIEW, `# Book II steading improvements — generated ${new Date().toISOString().slice(0, 10)}\n\n` +
	`${written} item(s) written to ${OUT}/. Requirement counts are the parsed pick rows; the bracketed\n` +
	`numbers are each row's track max (□ count). Spot-check against the book's call-out boxes.\n\n` +
	(rows.length ? rows.join("\n") : "_none found_") + "\n" +
	(flags.length ? `\n## Notes\n\n${flags.map((f) => `- ${f}`).join("\n")}\n` : ""));

console.log(`wrote ${written} improvement item(s) to ${OUT}/ (sortOrder 1–${sortOrder}); review → ${REVIEW}`);
if (flags.length) console.log(`\n${flags.length} note(s) for review:\n${flags.join("\n")}`);
