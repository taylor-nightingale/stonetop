// Build the GM-locked `wider-world-and-other-wonders` JournalEntry pack source from Book II.
// Usage: node scripts/import/pdf/build-journal.js ["Article Title" ...]   (no args = all articles)
// For each outline article it loads the pages (the exact preview pipeline), extracts the structured
// article, renders verbatim HTML via the shared renderer, extracts the illustrations to committed
// assets, and writes one JournalEntry JSON (one text page) to
// packs/src/wider-world-and-other-wonders/<slug>.json. Deterministic ids — the npc back-links
// (creatures.js journalUuid) resolve to these entries.
import { execFileSync } from "child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync } from "fs";
import os from "os";
import path from "path";
import { loadOutline, articleRanges } from "./outline.js";
import { extractArticle } from "./layout.js";
import { renderHtml } from "./render-html.js";
import { loadArticlePages } from "./load.js";
import { annotateTables } from "./tables.js";
import { buildPageMap, linkPageRefs, linkNpcs, loadNpcSlugs } from "./crossref.js";
import { linkArtifacts } from "../build-artifacts.js";
import { loadArcanaIndex, linkArcana } from "./arcana.js";
import { extractImprovements, improvementUuid } from "./improvements.js";
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
const DECOR_DIR = `${ASSET_DIR}/decor`;                           // journal chrome (chain, rule)
const DECOR_URL = `${ASSET_URL}/decor`;
const UI_DECOR_DIR = "assets/ui/decor";                           // shared UI glyphs (swirl bullets)
// Recurring marker/bullet glyphs are trade dress → committed, human-named, shipped in the system.
const MARKERS_DIR = `${ASSET_DIR}/markers`;
const MARKERS_URL = `${ASSET_URL}/markers`;
const MARKERS = JSON.parse(readFileSync("scripts/import/pdf/trade-dress.json", "utf8")).markers;
// Copyrighted illustrations → content-addressed into the gitignored external `stonetop-art/` root
// (resolves to Foundry's Data/stonetop-art/, outside the system install). Never committed.
const SHARED_DIR = "stonetop-art/wonders";
const SHARED_URL = "stonetop-art/wonders";

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
	rmSync(ASSET_DIR, { recursive: true, force: true });   // clear committed wonders art (markers/decor regenerated below)
	rmSync(SHARED_DIR, { recursive: true, force: true });  // clear the external illustration store so dedup starts clean
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
			dedup: { index: dedup, dir: SHARED_DIR, markers: { dir: MARKERS_DIR, map: MARKERS } },
			mapFile: (f) => {
				const rel = path.relative(MARKERS_DIR, f);
				return rel.startsWith("..") || path.isAbsolute(rel)
					? `${SHARED_URL}/${path.relative(SHARED_DIR, f)}`   // copyrighted illustration (external root)
					: `${MARKERS_URL}/${rel}`;                          // trade-dress marker glyph (system path)
			},
		});
		art = extractArticle(pages, { title: r.title, pageRules, pageImages });
		annotateTables(art, { slug, title: r.title }); // stamp dice tables → inline @DrawTable links
		// Stamp each "Steading improvement" call-out's title item with its generated item UUID so the
		// renderer links it (the item itself is written by build-improvements.js; UUIDs are deterministic).
		for (const imp of extractImprovements(art)) if (imp.titleItem) imp.titleItem.improvementUuid = improvementUuid(imp.slug);
		body = renderHtml(art, { chrome: { chain: chromeChain } });
	} catch (e) { flags.push(`! ${r.title}: failed — ${e.message}`); continue; }

	built.push({ i, r, slug, body, pageNumbers: art.pageNumbers, page: formatPageRange(art.pageNumbers) });
}
rmSync(scratch, { recursive: true, force: true });

const pageMap = buildPageMap(built);
const arcanaIndex = loadArcanaIndex(); // proper-noun arcana names → arcana-pack item UUIDs
const npcSlugs = loadNpcSlugs();       // generated NPC actors — stat-block names link to them
if (!npcSlugs.size) flags.push("? no wider-world-npcs sources found — stat-block names not linked (run build-npcs first)");

// Pass 2 — rewrite "(page N)" cross-refs to journal-entry links + arcana names to arcana items +
// stat-block names to NPC actors + artifact titles to possession items, then assemble + write
// each entry. The NPC/artifact passes run after the manual edits so those keep matching the
// verbatim text they were authored against.
let written = 0, links = 0, arcanaLinks = 0, npcLinks = 0, artifactLinks = 0;
for (const { i, r, slug, body, page } of built) {
	const id = deterministicId(JOURNAL_PACK, slug);
	const pageLinked = linkPageRefs(body, pageMap, { selfSlug: slug });
	const arc = linkArcana(pageLinked.html, arcanaIndex);
	const edited = applyManualEdits(arc.html, slug); // one-off per-article corrections (see manual-edits.js)
	for (const m of edited.misses) flags.push(`? ${r.title}: manual edit matched nothing — ${m}`);
	const npc = linkNpcs(edited.html, npcSlugs);
	const artifacts = linkArtifacts(npc.html);
	links += pageLinked.linked;
	arcanaLinks += arc.linked;
	npcLinks += npc.linked;
	artifactLinks += artifacts.linked;
	const ref = page ? `<p class="wonder-pageref">Book of the Wider World — p.${page}</p>` : "";
	const content = `<div class="stonetop-wonder">${ref}${artifacts.html}</div>`;

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

console.log(`\nwrote ${written} journal entr${written === 1 ? "y" : "ies"} to ${OUT}/ (${links} page-ref links, ${arcanaLinks} arcana links, ${npcLinks} npc links, ${artifactLinks} artifact links, ${dedup.size} distinct images in ${SHARED_DIR})`);
if (flags.length) console.log(`\n${flags.length} note(s) for review:\n` + flags.join("\n"));
