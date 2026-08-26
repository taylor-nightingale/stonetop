// Build Book I's reference articles into the `reference` pack — the pages a table reads at play.
//
// Usage: node scripts/import/build-book-one.js [Book_I.pdf]   (requires Book I and mutool)
//
//   • "Gear & Possessions"  (printed pp. 86-97) — inventory, load, Trade & Barter, the Value ladder,
//     Coins, and the Common/Special item tables.
//   • "If You Want To…"     (printed pp. 98-101) — one page per topic, which the sheets' ? buttons
//     open. Each page carries flags.stonetop.topic so a button can find its own without an id.
//
// The article's own formatting and images come from the shared pipeline (pdf/book-one.js). Its value
// tables are then rebuilt from the geometric parse so every row carries the book's ◇ load, its tags
// and track, and a @UUID link to the pack item — which is what makes a row draggable onto a sheet.
//
// Runs AFTER build-items.js, which is what creates the items those links point at.

import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";
import { deterministicId } from "./ids.js";
import { textPage, journalEntry, entryId } from "./journal-docs.js";
import { resolveBooks, requireTools } from "./pdf/books.js";
import { loadBookOneOutline, articleRange, renderArticle, replaceValueTables, splitTopicPages, linkBoldNames, collapseMarkRuns, restructureValueLadder, dropMarkOnlyBlocks, mergeCheckedCircles, dropFigures, replaceGlossary } from "./pdf/book-one.js";
import { parseItemTables, knownTagSlugs } from "./pdf/items.js";
import { loadItemUuidsBySlug } from "./pdf/crossref.js";
import { parseGearTerms } from "./pdf/tag-glossary.js";
import { applyBookOneEdits } from "./pdf/manual-edits.js";
import { normalizeName, resolveTableRows, sectionTitle, linkCoinPhrases, OUTFIT_PACK } from "./item-docs.js";
import { renderCategory } from "./item-reference.js";

const REFERENCE_PACK = "reference";
const OUT = `packs/src/${REFERENCE_PACK}`;
const OUTFIT_DIR = `packs/src/${OUTFIT_PACK}`;
// Book I's illustrations are copyrighted: they go to the gitignored external root, never committed.
const ART_DIR = "stonetop-art/book-one";
const ART_URL = "stonetop-art/book-one";
// The article's one ICON-sized figure — the pack-laden adventurer beside the Inventory rules — is
// also shown on the character sheet's outfit tab, so it gets a stable name there rather than the
// content-addressed one every other extracted image keeps. See OUTFITTING_ART in
// src/actors/character/outfitArt.js, which is what the sheet references.
const OUTFITTING_ART = "outfitting.png";
// The advice topic the Coins sidebar is shown beside — the key the steading's coinage ? carries.
const COINS_ADVICE_KEY = "coin";
// Every pack these articles cite a document from by name.
const CITED_PACKS = ["moves", "steading-improvements"];

const ARTICLES = [
	// `dropFigures` names the illustrations that do not belong on a reference page: the chapter plate
	// this spread opens with, and the tailpiece the topics article closes with.
	{ outline: "Gear and possessions", name: "Gear & Possessions", slug: "gear-and-possessions", tables: true, glossary: true, dropFigures: [0] },
	{ outline: "If you want to",       name: "If You Want To…",    slug: "if-you-want-to",       topics: true, dropFigures: [-1] },
];

const readJson = (f) => JSON.parse(readFileSync(f, "utf8"));

/** Every outfit item already in the pack, by normalized name — what a table row resolves against. */
function outfitItemsByName() {
	const walk = (d) => readdirSync(d).flatMap((n) => {
		const f = path.join(d, n);
		if (statSync(f).isDirectory()) return n === "_folders" ? [] : walk(f);
		return n.endsWith(".json") ? [f] : [];
	});
	return new Map(walk(OUTFIT_DIR).map((f) => readJson(f)).map((d) => [normalizeName(d.name), d]));
}

/** A pointer from one article to the gear page, for a section that defers to it. */
function seeAlso() {
	const gear = ARTICLES.find((a) => a.tables);
	const gearId = entryId(REFERENCE_PACK, gear.slug);
	const gearPageId = deterministicId(REFERENCE_PACK, `${gear.slug}#page`);
	return `<p class="stonetop-see-also">See @UUID[Compendium.stonetop.${REFERENCE_PACK}.JournalEntry.${gearId}.JournalEntryPage.${gearPageId}]{${gear.name}} for what a purse, a handful and a coin are worth.</p>`;
}

function main() {
	requireTools(["mutool", "pdfimages", "pdftoppm"]);
	const { bookI } = resolveBooks(process.argv.slice(2), process.env);
	const outline = loadBookOneOutline(bookI);
	const known = knownTagSlugs(readJson("languages/en.json"));

	// Item links: the same resolution build-items.js used to decide which rows already ship.
	const tables = parseItemTables(bookI, known);
	const resolved = resolveTableRows(tables, outfitItemsByName());
	// Bold names the books cite → the pack documents they name, so a page links on to the rules.
	const citedUuids = new Map();
	for (const pack of CITED_PACKS)
		for (const [slug, uuid] of loadItemUuidsBySlug(pack)) if (!citedUuids.has(slug)) citedUuids.set(slug, uuid);

	const idBySlug = new Map();
	for (const doc of outfitItemsByName().values()) if (doc.system?.slug) idBySlug.set(doc.system.slug, doc._id);

	mkdirSync(OUT, { recursive: true });
	mkdirSync(ART_DIR, { recursive: true });
	const scratch = mkdtempSync(path.join(os.tmpdir(), "book-one-"));
	const dedup = new Map();
	const flags = [];
	let written = 0;

	for (const [i, spec] of ARTICLES.entries()) {
		const range = articleRange(outline, spec.outline);
		const { html: raw, pages: stextPages } = renderArticle(bookI, range, {
			imgDir: scratch, imgPrefix: spec.slug, dedup: { index: dedup, dir: ART_DIR },
			mapFile: (f) => `${ART_URL}/${path.relative(ART_DIR, f)}`,
		});

		let html = raw;
		if (spec.glossary) {
			// The sidebar reads off the same page the article does; the modifiers come too, because the
			// page reproduces the sidebar as printed rather than the tag list the language file wants.
			const terms = stextPages.flatMap((pg) => parseGearTerms(pg.lines, { includeModifiers: true }));
			if (!terms.length) flags.push(`! ${spec.name}: no gear terms parsed — the glossary is still run-together prose`);
			else html = replaceGlossary(html, terms);
		}
		if (spec.tables) {
			const sections = tables.flatMap((t) => t.sections);
			const swap = replaceValueTables(html, sections, (section) =>
				renderCategory(section, section.items.map((it) => resolved.get(it)), { title: sectionTitle(section.title) }));
			html = swap.html;
			for (const m of swap.missing) flags.push(`? ${spec.name}: parsed section "${m}" matched no table in the article`);
			if (!swap.replaced.length) flags.push(`! ${spec.name}: no value table was replaced — links and ◇ are missing`);
		}
		html = dropFigures(dropMarkOnlyBlocks(mergeCheckedCircles(collapseMarkRuns(html))), spec.dropFigures);
		if (spec.tables) html = restructureValueLadder(html);

		// One-off corrections to what the parser made of this article, before anything is linked — the
		// finds are written against the book's own wording, not against text carrying UUIDs.
		const edited = applyBookOneEdits(html, spec.slug);
		for (const m of edited.misses) flags.push(`? ${spec.name}: manual edit matched nothing — ${m}`);
		html = edited.html;

		// Bold rule names become content links, then "a ◇ purse of coppers" in the prose becomes the
		// item itself — coin phrases last, so they are not re-linked inside a link just made.
		html = linkBoldNames(html, citedUuids);
		html = linkCoinPhrases(html, idBySlug);

		const id = entryId(REFERENCE_PACK, spec.slug);
		// The topics article stays ONE page you scroll, the way the book sets the spread. Each topic is
		// still addressable: its heading gives the page a table-of-contents anchor, and the entry
		// carries key → anchor so a ? button can jump to its own without guessing how Foundry slugs a
		// heading.
		let pages, entryFlags = { stonetop: { slug: spec.slug } };
		if (spec.topics) {
			const split = splitTopicPages(html);
			for (const t of split) if (!t.key) flags.push(`? ${spec.name}: heading "${t.title}" matches no advice topic`);
			// The coin topic explains how to GET coin; what a purse or a handful IS lives on the gear
			// page, so that section ends by naming it rather than the sidebar being duplicated.
			html = split.map((t) => (t.key === COINS_ADVICE_KEY ? t.html + seeAlso() : t.html)).join("");
			entryFlags.stonetop.topics = Object.fromEntries(
				split.filter((t) => t.key).map((t) => [t.key, t.anchor]));
		}
		pages = [textPage(REFERENCE_PACK, id, `${spec.slug}#page`, spec.name,
			`<div class="stonetop-wonder">${html}</div>`)];

		writeFileSync(path.join(OUT, `${spec.slug}.json`), JSON.stringify(
			journalEntry(REFERENCE_PACK, spec.slug, {
				name: spec.name, pages, sort: (i + 1) * 100000,
				ownership: 2,                                   // OBSERVER: a page a player can read
				flags: entryFlags,
			}), null, "\t") + "\n");
		written++;
		console.log(`  ${spec.name}: pp. ${range.pdfPage}-${range.endPage}, ${html.length} chars`);
	}

	// Copy the icon figure to its stable name. Content-addressed images are right for a journal page
	// (the reference IS the identity), but a sheet template naming a hash would break the moment the
	// extraction changed by a pixel.
	const gearHtml = readFileSync(path.join(OUT, `${ARTICLES.find((a) => a.tables).slug}.json`), "utf8");
	const icon = gearHtml.match(/<figure class=\\"icon\\">\s*<img[^>]*src=\\"[^\\"]*?\/([^\/\\"]+\.png)\\"/);
	if (icon) copyFileSync(path.join(ART_DIR, icon[1]), path.join(ART_DIR, OUTFITTING_ART));
	else flags.push(`? no icon figure found — ${OUTFITTING_ART} not refreshed (the outfit tab's art)`);

	rmSync(scratch, { recursive: true, force: true });
	console.log(`\nwrote ${written} entr${written === 1 ? "y" : "ies"} to ${OUT}/ (${dedup.size} images in ${ART_DIR})`);
	if (flags.length) console.log(`\n${flags.length} note(s) for review:\n` + flags.join("\n"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
