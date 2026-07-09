// Build steadfast items for the Wider-World places from the settlement stat box each place article
// prints (settlement.js parses it). A steadfast is a place's starting steading profile — the ratings
// it begins at plus the resources/fortifications backing Prosperity/Defenses — that a steading actor
// copies as its defaults (see SteadfastData). Book-only: everything not in the box (Fortunes/Surplus,
// coinage, residents, places, neighbors, improvements) is left at schema defaults, with Fortunes and
// Surplus seeded to 1 like Stonetop.
//
//   node scripts/import/pdf/build-steadfasts.js            # rebuild every place with a settlement box
//   node scripts/import/pdf/build-steadfasts.js "Barrier Pass" ...   # only the listed articles
//
// This script owns every generated steadfast — on a full rebuild it clears all of packs/src/steadfasts/
// except the hand-authored Stonetop steadfast (stonetop.json), then regenerates. A place with several
// settlement boxes (a region showing more than one example steading) yields one steadfast per box,
// disambiguated by a sub-heading label. A review summary is written for spot-checking.
import os from "os"; import path from "path";
import { mkdtempSync, rmSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { loadOutline, articleRanges } from "./outline.js";
import { loadArticlePages } from "./load.js";
import { extractArticle } from "./layout.js";
import { formatPageRange } from "./pages.js";
import { parseSettlement } from "./settlement.js";
import { titleCase } from "./arcana-parse.js";
import { deterministicId, documentKey } from "../ids.js";
import { toSlug } from "../../../src/utils/slug.js";

const PDF = process.env.BOOK_PDF ?? "helper/Book_II_-_The_Wider_World_and_Other_Wonders.pdf";
const PACK = "steadfasts";
const OUT = `packs/src/${PACK}`;
const REVIEW = "helper/steadfast-review.md";
const KEEP = new Set(["stonetop.json"]); // hand-authored — richer than the box; never regenerated
// Stonetop's own box lives in the book too, but its steadfast is hand-authored — never regenerate it.
const isStonetop = (title) => /stonetop/i.test(title);
// Two regions print more than one example steading; the book's nearest heading isn't a clean label, so
// name each box's steadfast explicitly (in book order). Any other multi-box article falls back to the
// preceding heading. Keyed by article title.
const REGION_LABELS = {
	"North Manmarch":          ["Hamlet", "Hillfort"],
	"The Whitefang Mountains": ["Steading", "Fortress-Monastery"],
};

const totalPages = () => Number((execFileSync("mutool", ["info", PDF], { encoding: "utf8" }).match(/Pages:\s*(\d+)/) || [])[1] || 302);

// Every settlement stat box in an article, each with the heading that precedes it (a fallback label
// for multi-box regions). Empty when the article has no box.
function findSettlements(art) {
	const boxes = [];
	let heading = "";
	for (const section of art.sections || [])
		for (const side of ["left", "right"])
			for (const col of section[side] || [])
				for (const b of col.blocks || []) {
					if (b.type === "heading") heading = (b.line?.text || "").trim();
					else if (b.type === "settlement") boxes.push({ lines: b.lines, heading });
				}
	return boxes;
}

const ranges = articleRanges(loadOutline(PDF), totalPages());
const byTitle = Object.fromEntries(ranges.map((r) => [r.title.toLowerCase(), r]));
const wanted = process.argv.slice(2);
const build = wanted.length ? wanted.map((t) => byTitle[t.toLowerCase()]).filter(Boolean) : ranges;
for (const t of wanted) if (!byTitle[t.toLowerCase()]) console.warn(`! no article titled ${JSON.stringify(t)}`);

mkdirSync(OUT, { recursive: true });
if (!wanted.length) for (const f of readdirSync(OUT)) if (f.endsWith(".json") && !KEEP.has(f)) rmSync(path.join(OUT, f)); // full rebuild
const scratch = mkdtempSync(path.join(os.tmpdir(), "steadfasts-"));
const flags = [];
const rows = []; // review lines
let sortOrder = 0, written = 0;

for (const r of build) {
	if (isStonetop(r.title)) continue;
	let art;
	try {
		const { pages, pageRules, pageImages } = loadArticlePages(PDF, r, { imgDir: scratch, imgPrefix: "sf" });
		art = extractArticle(pages, { title: r.title, pageRules, pageImages });
	} catch (e) { flags.push(`! ${r.title}: extract failed — ${e.message}`); continue; }

	const boxes = findSettlements(art);
	if (!boxes.length) continue; // not a steading — no box
	const page = formatPageRange(art.pageNumbers);

	boxes.forEach((box, i) => {
		const s = parseSettlement(box.lines);
		if (!s.size) flags.push(`? ${r.title}: a box parsed no Size — check the block`);

		// One box → the place name. Several boxes (a region's example steadings) → the place name plus a
		// disambiguating label (curated per region, else the box's preceding heading).
		const label = boxes.length > 1 ? (REGION_LABELS[r.title]?.[i] ?? titleCase(box.heading)) : "";
		const name  = label ? `${r.title} (${label})` : r.title;
		const slug  = toSlug(name);
		const id    = deterministicId(PACK, slug);
		const doc = {
			name,
			type: "steadfast",
			img: "icons/svg/village.svg",
			flags: {},
			_id: id,
			_key: documentKey("Item", id),
			system: {
				slug,
				sortOrder: ++sortOrder,
				description: "",
				attributes: {
					fortunes:   1,
					surplus:    1,
					size:       s.size,
					population: s.population,
					prosperity: s.prosperity,
					defenses:   s.defenses,
				},
				assets: {
					items:          [],
					resources:      s.resources,
					fortifications: s.fortifications,
					coinage:        [],
				},
				placesOfInterest: [],
				neighborPlaces:   [],
				residents:        { names: "", traits: [] },
				improvements:     [],
			},
		};
		writeFileSync(path.join(OUT, `${slug}.json`), JSON.stringify(doc, null, "\t") + "\n");
		written++;
		rows.push(`- **${name}** (Book p.${page}) — size ${s.size || "?"}, pop ${s.population >= 0 ? "+" : ""}${s.population}, ` +
			`prosperity ${s.prosperity >= 0 ? "+" : ""}${s.prosperity} (${s.resources.length} resources), ` +
			`defenses ${s.defenses >= 0 ? "+" : ""}${s.defenses} (${s.fortifications.length} fortifications)`);
	});
}
rmSync(scratch, { recursive: true, force: true });

writeFileSync(REVIEW, `# Book II steadfasts — generated ${new Date().toISOString().slice(0, 10)}\n\n` +
	`${written} steadfast item(s) written to ${OUT}/. Ratings + resource/fortification lists come from\n` +
	`each place's settlement box; Fortunes/Surplus seed to 1 and everything else is left empty. Spot-check\n` +
	`the lists against the book's boxes (esp. trade lines).\n\n` +
	(rows.length ? rows.join("\n") : "_none found_") + "\n" +
	(flags.length ? `\n## Notes\n\n${flags.map((f) => `- ${f}`).join("\n")}\n` : ""));

console.log(`wrote ${written} steadfast item(s) to ${OUT}/ (sortOrder 1–${sortOrder}); review → ${REVIEW}`);
