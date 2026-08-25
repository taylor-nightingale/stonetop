// Writes Book I's "If you want to…" advice (pp. 98-101) into languages/en.json under
// `stonetop.advice` — it is prose a player reads, so it lives where every other string a translator
// handles lives (see src/model/data/Advice.js, which reads it back). The sheets show one topic at a
// time behind a ? button next to the thing it explains.
//
// Names the book bolds — moves and steading improvements — become @UUID content links to the
// packs, so the advice is a way in to the rules it cites rather than a dead end.
//
// Run `npm run advice` after changing which pages are parsed. Requires Book I and mutool.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadOutline } from "./outline.js";
import { loadArticlePages } from "./load.js";
import { extractArticle } from "./layout.js";
import { loadItemUuidsBySlug } from "./crossref.js";
import { resolveBooks, requireTools } from "./books.js";
import { parseAdvice } from "./advice.js";

const OUT = "languages/en.json";
const ARTICLE = /^if you want to/i;
// Every pack the spread cites a document from by name.
const CITED_PACKS = ["moves", "steading-improvements"];

/**
 * The article's page range, from the outline's own entry. The spread sits at depth 2 (it is a
 * section of "Playing the Game", not a chapter), which articleRanges doesn't walk — and its end is
 * simply the page before whatever the outline lists next.
 */
export function adviceRange(outline) {
	const at = outline.findIndex((e) => ARTICLE.test(e.title));
	if (at < 0) throw new Error(`Book I outline has no "If you want to…" entry`);
	const next = outline.slice(at + 1).find((e) => e.pdfPage > outline[at].pdfPage);
	if (!next) throw new Error(`"If you want to…" is the last outline entry — cannot bound it`);
	return { title: outline[at].title, pdfPage: outline[at].pdfPage, endPage: next.pdfPage - 1 };
}

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

	// Every other key in the language file is hand-authored, so only `stonetop.advice` is replaced
	// (the ? button's own labels are hand-authored, and live under `stonetop.sheet.advice`).
	const strings = JSON.parse(readFileSync(OUT, "utf8"));
	strings.stonetop.advice = advice.toTranslation();
	writeFileSync(OUT, JSON.stringify(strings, null, "\t") + "\n");

	const links = JSON.stringify(advice.topics).match(/@UUID\[/g)?.length ?? 0;
	console.log(`${OUT}: ${advice.topics.length} advice topics from pages ${range.pdfPage}-${range.endPage} (${links} links)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
