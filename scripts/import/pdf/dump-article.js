// Dev helper: render full articles to standalone HTML for fidelity review.
// Usage: node scripts/import/pdf/dump-article.js ["Article Title" ...]
// Output: helper/_preview/<slug>.html (gitignored). Content is CC-licensed Stonetop text.
import { execFileSync } from "child_process";
import { writeFileSync } from "fs";
import path from "path";
import { loadOutline, articleRanges } from "./outline.js";
import { extractArticle } from "./layout.js";
import { renderHtml } from "./render-html.js";
import { loadArticlePages } from "./load.js";
import { extractChrome, extractSwirls } from "./images.js";
import { formatPageRange } from "./pages.js";
import { toSlug } from "../../../src/utils/slug.js";

const PDF = process.env.BOOK_PDF ?? "helper/Book_II_-_The_Wider_World_and_Other_Wonders.pdf";
const OUT = "helper/_preview";

const DEFAULTS = ["The village of Stonetop", "Aratis, the Lawkeeper", "The Crombil", "Marshedge", "Forge Lords"];

function totalPages() {
	const out = execFileSync("mutool", ["info", PDF], { encoding: "utf8" });
	return Number((out.match(/Pages:\s*(\d+)/) || [])[1] || 302);
}

const rel = (p) => (p ? path.relative(OUT, p) : "");

const PAGE = (title, bookPages, body, chrome) => `<!doctype html><html><head><meta charset="utf-8">
<title>${title}</title><style>
body{font:16px/1.5 Georgia,serif;max-width:46em;margin:2em auto;padding:0 1em;color:#222}
h1{font-family:system-ui;margin:.1em 0;text-align:center}
h2{font-family:system-ui;margin:.1em 0 .3em;color:#7a3}
h3{font-family:system-ui;color:#a63}
h4{font-family:system-ui;margin:.6em 0 .2em}
.page-ref{color:#888;font:13px system-ui;text-align:center}
ul{margin:.4em 0}
table{border-collapse:collapse;margin:.6em 0}
th,td{border:1px solid #ccc;padding:.15em .5em;text-align:left;vertical-align:top}
figure.art{margin:1em 0;text-align:center}
figure.art img{max-width:100%}
figure.icon{margin:.2em 0;text-align:left}
img.icon,figure.icon img{height:1.29em;vertical-align:middle;margin-right:.25em}
/* list bullets drawn as the book's swirl glyphs (plain spiral / pointing spiral) */
li.swirl,li.swirl-point{list-style:none}
li.swirl::before{content:"";display:inline-block;width:.9em;height:.9em;margin:0 .35em 0 -1.3em;vertical-align:-.12em;background:url(img/swirl.png) no-repeat left center/contain}
li.swirl-point::before{content:"";display:inline-block;width:1.4em;height:.9em;margin:0 .35em 0 -1.7em;vertical-align:-.12em;background:url(img/swirl-point.png) no-repeat left center/contain}
/* stylized arrow bullets (the book's "ä" dingbat) — stat-block moves and ä-lists */
ul.sb-moves,li.arrow{list-style:none}
ul.sb-moves>li::before,li.arrow::before{content:"\\27A4";color:#444;margin:0 .35em 0 -1.1em;font-size:.85em}
/* each printed page folds to two side-by-side columns (A|B on top, C|D below) */
.page2col{display:flex;gap:1.5em;align-items:flex-start;margin:.2em 0}
.page2col>.col{flex:1;min-width:0}
.box{border:1px solid #888;border-radius:3px;padding:.3em .7em;margin:.5em 0}
aside.statblock{border:1px solid #ccc;background:#faf8f2;padding:.5em .8em;margin:.8em 0;font-size:.95em}
.sb-name{font-family:system-ui;font-size:1.1em}
/* chain band above the title — normalized to black-on-transparent, left-aligned */
.chain{display:block;height:auto;margin:.3em 0;max-width:80%}
/* thin section-divider lines (from the vector layer), left-aligned, full column width */
hr.rule{border:0;border-top:1px solid #000;width:11em;margin:.2em 0 .5em}
/* braided rule above a column-top section — reuse the (correct) chain asset, left-aligned */
img.braid{display:block;height:auto;max-width:13em;margin:.8em 0 .2em}
img.braid-wide{display:block;width:100%;height:auto;margin:.8em 0}
.npc-box{border:1px solid #ccc;background:#faf8f2;padding:.5em .8em;margin:.8em 0;font-size:.95em}
.npc-title{font-family:system-ui;font-size:1.1em;font-weight:bold;margin:.1em 0 .4em}
.npc-title img.icon{height:1em}
</style></head><body>
${chrome.chain ? `<img class="chain" src="${rel(chrome.chain)}">` : ""}
<h1>${title}</h1><p class="page-ref">Book pages: ${formatPageRange(bookPages) || "?"}</p>
${body}
</body></html>`;

const titles = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULTS;
const ranges = articleRanges(loadOutline(PDF), totalPages());
const chrome = extractChrome(PDF, `${OUT}/img`);
extractSwirls(PDF, `${OUT}/img`); // shared swirl bullet assets (img/swirl.png, img/swirl-point.png)
const byTitle = Object.fromEntries(ranges.map((r) => [r.title.toLowerCase(), r]));

for (const wanted of titles) {
	const r = byTitle[wanted.toLowerCase()];
	if (!r) { console.warn(`! no article titled ${JSON.stringify(wanted)}`); continue; }
	const slug = toSlug(r.title);

	const { pages, pageRules, pageImages } = loadArticlePages(PDF, r, { imgDir: `${OUT}/img`, imgPrefix: slug, mapFile: rel });
	const art = extractArticle(pages, { title: r.title, pageRules, pageImages });
	// The preview pre-resolves image refs to OUT-relative paths (asset = identity); the Foundry
	// build will pass its own `asset` resolver + chrome paths to the same renderer.
	const body = renderHtml(art, { chrome: { chain: chrome.chain ? rel(chrome.chain) : null } });
	const file = `${OUT}/${slug}.html`;
	writeFileSync(file, PAGE(r.title, art.pageNumbers, body, chrome));
	const nImg = pageImages.reduce((n, p) => n + p.length, 0);
	console.log(`wrote ${file}  (book ${formatPageRange(art.pageNumbers)}, ${nImg} image(s) inline)`);
}
