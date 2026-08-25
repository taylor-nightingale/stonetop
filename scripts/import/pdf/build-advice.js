// Writes the TITLES of Book I's "If you want to…" topics (pp. 98-101) into languages/en.json under
// `stonetop.advice` — the words a ? button labels itself with, which it needs synchronously and
// before any pack has loaded, and which a translator should handle alongside every other string.
//
// The advice PROSE is not here: it is a journal page per topic in the `reference` pack, built by
// scripts/import/build-book-one.js from the same article. A page resizes, remembers its size, and
// lists its siblings — none of which a dialog assembled from strings does. The parse still runs in
// full so that a reprint which reworders a heading fails loudly here, where the keys are declared.
//
// Run `npm run advice` after changing which pages are parsed. Requires Book I and mutool.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadOutline, entryRange } from "./outline.js";
import { loadArticlePages } from "./load.js";
import { extractArticle } from "./layout.js";
import { loadItemUuidsBySlug } from "./crossref.js";
import { resolveBooks, requireTools } from "./books.js";
import { parseAdvice } from "./advice.js";

const OUT = "languages/en.json";
const ARTICLE = /^if you want to/i;
// Every pack the spread cites a document from by name.
const CITED_PACKS = ["moves", "steading-improvements"];

/** The "If you want to…" spread's page range — see outline.js entryRange. */
export const adviceRange = (outline) => entryRange(outline, "if you want to");

function main() {
	requireTools(["mutool"]);
	const { bookI } = resolveBooks(process.argv.slice(2), process.env);

	const range = adviceRange(loadOutline(bookI));
	// The spread carries illustrations we don't want; loadArticlePages extracts them regardless, so
	// give it somewhere temporary to put them and throw it away.
	const scratch = mkdtempSync(path.join(os.tmpdir(), "stonetop-advice-"));
	let article;
	try {
		const { pages, pageRules, pageImages } = loadArticlePages(bookI, range, { imgDir: scratch });
		article = extractArticle(pages, { title: range.title, pageRules, pageImages });
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}

	const uuids = new Map();
	for (const pack of CITED_PACKS)
		for (const [slug, uuid] of loadItemUuidsBySlug(pack)) if (!uuids.has(slug)) uuids.set(slug, uuid);

	const advice = parseAdvice(article).withReferences(uuids);

	// Titles only — the prose lives in the reference pack. Every other key in the language file is
	// hand-authored or another builder's, so only `stonetop.advice` is replaced.
	const strings = JSON.parse(readFileSync(OUT, "utf8"));
	strings.stonetop.advice = Object.fromEntries(advice.topics.map((t) => [t.key, { title: t.title }]));
	writeFileSync(OUT, JSON.stringify(strings, null, "\t") + "\n");

	console.log(`${OUT}: ${advice.topics.length} advice topic titles from pages ${range.pdfPage}-${range.endPage}`);
	console.log(`  (the prose is built into the reference pack by build-book-one.js)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
