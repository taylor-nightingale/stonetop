// Build the GM-locked `wider-world-and-other-wonders` JournalEntry pack source from Book II.
// Usage: node scripts/import/pdf/build-journal.js ["Article Title" ...]   (no args = all articles)
// For each outline article it loads the pages (the exact preview pipeline), extracts the structured
// article, renders verbatim HTML via the shared renderer, extracts the illustrations to committed
// assets, and writes one JournalEntry JSON (one text page) to
// packs/src/wider-world-and-other-wonders/<slug>.json. Deterministic ids — the npc back-links
// (creatures.js journalUuid) resolve to these entries.
import { execFileSync } from "child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readdirSync } from "fs";
import os from "os";
import path from "path";
import { loadOutline, articleRanges } from "./outline.js";
import { extractArticle } from "./layout.js";
import { renderHtml } from "./render-html.js";
import { loadArticlePages } from "./load.js";
import { annotateTables } from "./tables.js";
import { buildPageMap, linkPageRefs } from "./crossref.js";
import { loadArcanaIndex, linkArcana } from "./arcana.js";
import { applyManualEdits } from "./manual-edits.js";
import { extractChrome, extractSwirls } from "./images.js";
import { formatPageRange } from "./pages.js";
import { deterministicId, documentKey } from "../ids.js";
import { toSlug } from "../../../src/utils/slug.js";
import { JOURNAL_PACK } from "./creatures.js";

const PDF = process.env.BOOK_PDF ?? "helper/Book_II_-_The_Wider_World_and_Other_Wonders.pdf";
const OUT = `packs/src/${JOURNAL_PACK}`;
const ASSET_DIR = "assets/content/wonders";                       // committed art, on disk
const ASSET_URL = "systems/stonetop/assets/content/wonders";      // how Foundry serves it
const SHARED_DIR = `${ASSET_DIR}/shared`;                         // content-addressed, deduped images
const DECOR_DIR = `${ASSET_DIR}/decor`;                           // journal chrome (chain, rule)
const DECOR_URL = `${ASSET_URL}/decor`;
const UI_DECOR_DIR = "assets/ui/decor";                           // shared UI glyphs (swirl bullets)

function totalPages() {
	const out = execFileSync("mutool", ["info", PDF], { encoding: "utf8" });
	return Number((out.match(/Pages:\s*(\d+)/) || [])[1] || 302);
}

/** A text JournalEntryPage embedded in `entry`. Needs its own `_key` so the CLI packs it under
 *  `!journal.pages!<entryId>.<pageId>` (the parent stores only the page id). */
function textPage(entryId, slug, name, content) {
	const id = deterministicId(JOURNAL_PACK, `${slug}#page`);
	return {
		_id: id,
		_key: `!journal.pages!${entryId}.${id}`,
		name,
		type: "text",
		title: { show: false, level: 1 },
		image: {},
		src: null,
		text: { format: 1, content, markdown: undefined },
		video: { controls: true, volume: 0.5 },
		system: {},
		sort: 0,
		ownership: { default: -1 },
		flags: {},
	};
}

const ranges = articleRanges(loadOutline(PDF), totalPages());
const byTitle = Object.fromEntries(ranges.map((r) => [r.title.toLowerCase(), r]));
const wanted = process.argv.slice(2);
const build = wanted.length ? wanted.map((t) => byTitle[t.toLowerCase()]).filter(Boolean) : ranges;
if (wanted.length && build.length !== wanted.length) for (const t of wanted) if (!byTitle[t.toLowerCase()]) console.warn(`! no article titled ${JSON.stringify(t)}`);

mkdirSync(OUT, { recursive: true });
if (!wanted.length) {
	for (const f of readdirSync(OUT).filter((n) => n.endsWith(".json"))) rmSync(path.join(OUT, f)); // full rebuild
	rmSync(ASSET_DIR, { recursive: true, force: true }); // clear old per-article + shared art so dedup starts clean
}

// Journal chrome (chain/rule) → content/wonders/decor; the swirl list-bullet glyphs are shared UI
// assets → assets/ui/decor (used by sheets too). Extract once.
mkdirSync(DECOR_DIR, { recursive: true });
mkdirSync(SHARED_DIR, { recursive: true });
const chrome = extractChrome(PDF, DECOR_DIR);
extractSwirls(PDF, UI_DECOR_DIR);
const chromeChain = chrome.chain ? `${DECOR_URL}/${path.basename(chrome.chain)}` : null;

// All extracted illustrations/icons are content-addressed into SHARED_DIR (one file per distinct
// image); pdfimages scratch goes to a throwaway temp dir.
const dedup = new Map();
const scratch = mkdtempSync(path.join(os.tmpdir(), "ww-img-"));

const flags = [];

// Pass 1 — extract + render each article's body, and harvest its printed page numbers. We need the
// full printed-page → article map before we can rewrite "(page N)" cross-refs, so render first and
// link after. (On a partial build only the listed articles populate the map, so cross-refs resolve
// only within that set; the full rebuild — no args — is the shipping path.)
const built = [];
for (const [i, r] of build.entries()) {
	const slug = toSlug(r.title);
	let art, body;
	try {
		const { pages, pageRules, pageImages } = loadArticlePages(PDF, r, {
			imgDir: scratch,
			imgPrefix: slug,
			dedup: { index: dedup, dir: SHARED_DIR },
			mapFile: (f) => `${ASSET_URL}/${path.relative(ASSET_DIR, f)}`,
		});
		art = extractArticle(pages, { title: r.title, pageRules, pageImages });
		annotateTables(art, { slug, title: r.title }); // stamp dice tables → inline @DrawTable links
		body = renderHtml(art, { chrome: { chain: chromeChain } });
	} catch (e) { flags.push(`! ${r.title}: failed — ${e.message}`); continue; }

	built.push({ i, r, slug, body, pageNumbers: art.pageNumbers, page: formatPageRange(art.pageNumbers) });
}
rmSync(scratch, { recursive: true, force: true });

const pageMap = buildPageMap(built);
const arcanaIndex = loadArcanaIndex(); // proper-noun arcana names → arcana-pack item UUIDs

// Pass 2 — rewrite "(page N)" cross-refs to journal-entry links + arcana names to arcana items,
// then assemble + write each entry.
let written = 0, links = 0, arcanaLinks = 0;
for (const { i, r, slug, body, page } of built) {
	const id = deterministicId(JOURNAL_PACK, slug);
	const pageLinked = linkPageRefs(body, pageMap, { selfSlug: slug });
	const arc = linkArcana(pageLinked.html, arcanaIndex);
	const edited = applyManualEdits(arc.html, slug); // one-off per-article corrections (see manual-edits.js)
	for (const m of edited.misses) flags.push(`? ${r.title}: manual edit matched nothing — ${m}`);
	links += pageLinked.linked;
	arcanaLinks += arc.linked;
	const ref = page ? `<p class="wonder-pageref">Book of the Wider World — p.${page}</p>` : "";
	const content = `<div class="stonetop-wonder">${ref}${edited.html}</div>`;

	const entry = {
		_id: id,
		_key: documentKey("JournalEntry", id),
		name: r.title,
		pages: [textPage(id, slug, r.title, content)],
		folder: null,
		sort: (i + 1) * 100000,
		ownership: { default: 0 },
		flags: { stonetop: { bookPages: page, slug } },
	};
	writeFileSync(path.join(OUT, `${slug}.json`), JSON.stringify(entry, null, 2) + "\n");
	written++;
}

console.log(`\nwrote ${written} journal entr${written === 1 ? "y" : "ies"} to ${OUT}/ (${links} page-ref links, ${arcanaLinks} arcana links, ${dedup.size} distinct images in ${SHARED_DIR})`);
if (flags.length) console.log(`\n${flags.length} note(s) for review:\n` + flags.join("\n"));
