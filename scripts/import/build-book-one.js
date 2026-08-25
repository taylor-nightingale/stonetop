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

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";
import { deterministicId, documentKey } from "./ids.js";
import { resolveBooks, requireTools } from "./pdf/books.js";
import { loadBookOneOutline, articleRange, renderArticle, replaceValueTables } from "./pdf/book-one.js";
import { parseItemTables, knownTagSlugs } from "./pdf/items.js";
import { loadValueGuide } from "./pdf/value-ladder.js";
import { normalizeName, resolveTableRows, sectionTitle, linkCoinPhrases, OUTFIT_PACK } from "./item-docs.js";
import { renderCategory } from "./item-reference.js";

const REFERENCE_PACK = "reference";
const OUT = `packs/src/${REFERENCE_PACK}`;
const OUTFIT_DIR = `packs/src/${OUTFIT_PACK}`;
// Book I's illustrations are copyrighted: they go to the gitignored external root, never committed.
const ART_DIR = "stonetop-art/book-one";
const ART_URL = "stonetop-art/book-one";
const LANG = "languages/en.json";
// The advice topic the Coins sidebar is shown beside — the key the steading's coinage ? carries.
const COINS_ADVICE_KEY = "coin";

const ARTICLES = [
	{ outline: "Gear and possessions", name: "Gear & Possessions", slug: "gear-and-possessions", tables: true },
	{ outline: "If you want to",       name: "If You Want To…",    slug: "if-you-want-to",       topics: true },
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

/** A text JournalEntryPage embedded in `entry`. */
function textPage(entryId, slug, name, content, flags = {}) {
	const id = deterministicId(REFERENCE_PACK, `${slug}#page`);
	return {
		_id: id,
		_key: `!journal.pages!${entryId}.${id}`,
		name,
		type: "text",
		title: { show: false, level: 1 },
		image: {}, src: null,
		text: { format: 1, content, markdown: undefined },
		video: { controls: true, volume: 0.5 },
		system: {}, sort: 0,
		ownership: { default: -1 },
		flags,
	};
}

function main() {
	requireTools(["mutool", "pdfimages", "pdftoppm"]);
	const { bookI } = resolveBooks(process.argv.slice(2), process.env);
	const outline = loadBookOneOutline(bookI);
	const known = knownTagSlugs(readJson("languages/en.json"));

	// Item links: the same resolution build-items.js used to decide which rows already ship.
	const tables = parseItemTables(bookI, known);
	const resolved = resolveTableRows(tables, outfitItemsByName());
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
		const { html: raw } = renderArticle(bookI, range, {
			imgDir: scratch, imgPrefix: spec.slug, dedup: { index: dedup, dir: ART_DIR },
			mapFile: (f) => `${ART_URL}/${path.relative(ART_DIR, f)}`,
		});

		let html = raw;
		if (spec.tables) {
			const sections = tables.flatMap((t) => t.sections);
			const swap = replaceValueTables(html, sections, (section) =>
				renderCategory(section, section.items.map((it) => resolved.get(it)), { title: sectionTitle(section.title) }));
			html = swap.html;
			for (const m of swap.missing) flags.push(`? ${spec.name}: parsed section "${m}" matched no table in the article`);
			if (!swap.replaced.length) flags.push(`! ${spec.name}: no value table was replaced — links and ◇ are missing`);
		}
		// "a ◇ purse of coppers" in the prose becomes the item itself, wherever it is mentioned.
		html = linkCoinPhrases(html, idBySlug);

		const id = deterministicId(REFERENCE_PACK, spec.slug);
		writeFileSync(path.join(OUT, `${spec.slug}.json`), JSON.stringify({
			_id: id,
			_key: documentKey("JournalEntry", id),
			name: spec.name,
			pages: [textPage(id, spec.slug, spec.name, `<div class="stonetop-wonder">${html}</div>`)],
			folder: null,
			sort: (i + 1) * 100000,
			ownership: { default: 2 },
			flags: { stonetop: { slug: spec.slug } },
		}, null, "\t") + "\n");
		written++;
		console.log(`  ${spec.name}: pp. ${range.pdfPage}-${range.endPage}, ${html.length} chars`);
	}

	// The Coins sidebar also answers a question the steading sheet asks: its coinage ? explains how to
	// GET coin, while the three fields under it are labelled Purses / Handfuls / Coins and nothing
	// says a handful is about ten. The same prose is written into the language file, in the block
	// shape the advice dialog renders (src/model/data/Reference.js), with a link on to the page built
	// above — generated here, where that page's ids are known, so nothing hard-codes them.
	const lang = readJson(LANG);
	if (!lang.stonetop?.advice?.[COINS_ADVICE_KEY]) {
		throw new Error(`languages/en.json has no advice topic "${COINS_ADVICE_KEY}" — the Coins sidebar hangs off it.`);
	}
	const { guide } = loadValueGuide(bookI);
	const gear = ARTICLES.find((a) => a.tables);
	const gearId = deterministicId(REFERENCE_PACK, gear.slug);
	const gearPageId = deterministicId(REFERENCE_PACK, `${gear.slug}#page`);
	lang.stonetop.reference = {
		...(lang.stonetop.reference ?? {}),
		[COINS_ADVICE_KEY]: {
			title: "Coins",
			blocks: [
				...guide.coins.paragraphs.map((text) => ({ type: "para", text })),
				...(guide.coins.bullets.length ? [{ type: "list", items: guide.coins.bullets }] : []),
				{ type: "para", text: `See @UUID[Compendium.stonetop.${REFERENCE_PACK}.JournalEntry.${gearId}.JournalEntryPage.${gearPageId}]{${gear.name}} for what everything is worth.` },
			],
		},
	};
	writeFileSync(LANG, JSON.stringify(lang, null, "\t") + "\n");

	rmSync(scratch, { recursive: true, force: true });
	console.log(`\nwrote ${written} entr${written === 1 ? "y" : "ies"} to ${OUT}/ (${dedup.size} images in ${ART_DIR})`);
	if (flags.length) console.log(`\n${flags.length} note(s) for review:\n` + flags.join("\n"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
