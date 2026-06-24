// Build the GM-locked `wider-world-npcs` Actor pack source from Book II's monster stat blocks.
// Usage: node scripts/import/pdf/build-npcs.js
// Walks every outline article, extracts each stat block, parses it into our npc schema, and writes
// one Actor JSON per creature to packs/src/wider-world-npcs/ (deterministic ids; re-runs are stable).
import { execFileSync } from "child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readdirSync } from "fs";
import os from "os";
import path from "path";
import { loadOutline, articleRanges } from "./outline.js";
import { extractArticle } from "./layout.js";
import { loadArticlePages } from "./load.js";
import { parseStatBlock, toNpcDoc, MONSTER_PACK } from "./creatures.js";
import { formatPageRange } from "./pages.js";
import { toSlug } from "../../../src/utils/slug.js";

const PDF = process.env.BOOK_PDF ?? "helper/Book_II_-_The_Wider_World_and_Other_Wonders.pdf";
const OUT = `packs/src/${MONSTER_PACK}`;

function totalPages() {
	const out = execFileSync("mutool", ["info", PDF], { encoding: "utf8" });
	return Number((out.match(/Pages:\s*(\d+)/) || [])[1] || 302);
}

// Collect the stat-block blocks from an extracted article (flattened across spreads/columns).
function statBlocks(art) {
	const out = [];
	for (const s of art.sections) for (const c of [...s.left, ...s.right]) for (const b of c.blocks) if (b.type === "statblock") out.push(b);
	return out;
}

const ranges = articleRanges(loadOutline(PDF), totalPages());
const tmp = mkdtempSync(path.join(os.tmpdir(), "ww-npc-"));
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT).filter((n) => n.endsWith(".json"))) rmSync(path.join(OUT, f)); // rebuild fresh

const seen = new Map(); // slug -> source article (to flag cross-article name collisions)
const flags = [];
let written = 0;

for (const r of ranges) {
	const slug = toSlug(r.title);
	let art;
	try {
		const { pages, pageRules, pageImages } = loadArticlePages(PDF, r, { imgDir: tmp, imgPrefix: slug });
		art = extractArticle(pages, { title: r.title, pageRules, pageImages });
	} catch (e) { flags.push(`! ${r.title}: load failed — ${e.message}`); continue; }

	const page = formatPageRange(art.pageNumbers);
	for (const sb of statBlocks(art)) {
		const creature = parseStatBlock(sb.lines);
		if (!creature.name) { flags.push(`? ${r.title}: stat block with no detected name (hp=${creature.hp.value}) — skipped`); continue; }
		const doc = toNpcDoc(creature, { article: { slug, title: r.title, page } });
		if (seen.has(doc.system.slug)) { flags.push(`? duplicate "${creature.name}" in ${r.title} (also ${seen.get(doc.system.slug)}) — keeping first`); continue; }
		seen.set(doc.system.slug, r.title);
		writeFileSync(path.join(OUT, `${doc.system.slug}.json`), JSON.stringify(doc, null, 2) + "\n");
		written++;
	}
}
rmSync(tmp, { recursive: true, force: true });

console.log(`\nwrote ${written} npc(s) to ${OUT}/`);
if (flags.length) console.log(`\n${flags.length} note(s) for review:\n` + flags.join("\n"));
