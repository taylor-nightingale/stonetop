// Book I articles → journal HTML, through the same pipeline Book II uses.
//
// The shared pipeline (load.js → layout.js → render-html.js) already reproduces an article's own
// headings, prose, tables and images. Two things differ for Book I:
//
//   • Its inline load diamonds are FONT GLYPHS (glyphs.js), not vector art. Its vector ◇/○ marks
//     belong to figures — the sample inventory insert printed on "Gear and possessions" carries 117
//     of them — so pages load with marker splicing off, or those scatter through the prose.
//   • Its value tables are rendered generically, which drops the ◇ load column, truncates a wrapped
//     row and leaves every item name as plain text. Those are rebuilt from the geometric parse.

import { loadOutline, entryRange } from "./outline.js";
import { loadArticlePages, attachMarkers } from "./load.js";
import { isGlyphFont } from "./glyphs.js";
import { loadMarkers } from "./rules.js";
import { extractArticle } from "./layout.js";
import { renderHtml } from "./render-html.js";
import { ADVICE_TOPICS } from "./advice.js";
import { toSlug } from "../../../src/utils/slug.js";

/** The type size most of a page is set in — its body. A figure's own labels are set smaller. */
function bodySize(page) {
	const counts = new Map();
	for (const l of page.lines) counts.set(l.size, (counts.get(l.size) ?? 0) + 1);
	return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

/** Whether a point sits within any figure, with a little slack for a label set just past its edge. */
// Slack around a figure, for a label or mark set just past its edge.
export const FIGURE_PAD = 10;

const inFigure = (x, y, images, pad = FIGURE_PAD) =>
	images.some((im) => x >= im.x - pad && x <= im.x + im.w + pad && y >= im.y - pad && y <= im.y + im.h + pad);

/**
 * Text drawn INSIDE a figure is part of the picture, not the article.
 *
 * "Gear and possessions" prints a filled-in sample of the Inventory insert across its opening spread
 * (printed pp. 86-87), and that sample is a form full of words. The extractor has no way to know
 * they are not prose, so they arrive interleaved with the real columns.
 *
 * Geometry alone cannot separate them: the figure's box reaches well into the neighbouring column,
 * so dropping everything inside it also eats the article's own sentences. What actually separates
 * them is TYPE SIZE — the sample is set a point smaller than the body around it — so a line is
 * dropped only when it is both within a figure and smaller than the page's body size.
 */
export function dropFigureText(page, images = [], { pad = 10 } = {}) {
	if (!images.length) return page;
	const body = bodySize(page);
	const drop = (l) => l.size < body
		&& inFigure((l.bbox[0] + l.bbox[2]) / 2, (l.bbox[1] + l.bbox[3]) / 2, images, pad);
	return { ...page, lines: page.lines.filter((l) => !drop(l)) };
}

// A marked slot is drawn TWICE: the dingbat glyph draws the ticked diamond, and the vector layer
// draws its outline a couple of points to the left of it. Attaching both puts a phantom empty ◇ in
// front of every filled one — "◇◆◆ firewood" where the book prints "◆◆ firewood".
const GLYPH_OFFSET = 6;

/** The x of every glyph character on `page`, by the row it sits on. */
function glyphPositions(page) {
	const out = [];
	for (const l of page.lines)
		for (const sp of l.spans ?? []) {
			if (!isGlyphFont(sp.font)) continue;
			(sp.xs ?? []).forEach((x, i) => { if ((sp.text[i] ?? "").trim()) out.push({ x, top: l.bbox[1], bottom: l.bbox[3] }); });
		}
	return out;
}

/** Drop vector marks that merely outline a glyph already in the text. */
export function dropGlyphDuplicates(page, markers) {
	const glyphs = glyphPositions(page);
	if (!glyphs.length) return markers;
	return markers.filter((mk) => {
		const cy = mk.y - mk.h / 2;
		return !glyphs.some((g) => g.top - 3 <= cy && g.bottom + 3 >= cy
			&& g.x >= mk.x && g.x <= mk.x + GLYPH_OFFSET);
	});
}

/**
 * Render one Book I article to HTML, with its images extracted into `imgDir`.
 *
 * `figureText: true` keeps text drawn inside a figure — see dropFigureText. It is off by default
 * because Book I illustrates its rules with filled-in samples of the sheets they describe.
 */
export function renderArticle(pdf, range, { imgDir, imgPrefix, mapFile, dedup, figureText = false } = {}) {
	// Marks are attached HERE, with the SHARED attacher, rather than by loadArticlePages — not
	// because Book I needs different placement, but because the figures' own marks have to be
	// filtered out first, and loadArticlePages only works out where the figures are afterwards.
	const { pages, pageRules, pageImages, startPage } =
		loadArticlePages(pdf, range, { imgDir, imgPrefix, mapFile, dedup, markers: false });
	pages.forEach((pg, i) => {
		const marks = dropGlyphDuplicates(pg, loadMarkers(pdf, (startPage ?? range.pdfPage) + i)
			.filter((mk) => !inFigure(mk.x, mk.y - mk.h / 2, pageImages[i] ?? [], FIGURE_PAD)));
		attachMarkers(pg, marks);
	});
	const clean = figureText ? pages : pages.map((pg, i) => dropFigureText(pg, pageImages[i] ?? []));
	// markBullets off: Book I writes its marks INTO sentences, so a mark-led line is prose, not a
	// bulleted item (see layout.js isItemStart).
	const article = extractArticle(clean, { title: range.title, pageRules, pageImages, markBullets: false });
	// `pages` are the cleaned stext pages, so a caller can read structure the renderer flattened —
	// the gear-terms glossary is rebuilt from the lines rather than from the prose it became.
	return { article, pages: clean, html: renderHtml(article), pageNumbers: article.pageNumbers };
}

export const loadBookOneOutline = (pdf) => loadOutline(pdf);

/** An article's page range, from Book I's own outline entry. */
export const articleRange = (outline, title) => entryRange(outline, title);

// ─── value tables ────────────────────────────────────────────────────────────

// A rendered table, captured whole with the heading of its first column — which is the book's own
// section name ("weapons", "trade goods") and so what pairs it with a parsed section.
const TABLE = /<table>(?:(?!<\/table>)[\s\S])*?<\/table>/g;
const FIRST_TH = /<thead>\s*<tr>\s*<th>(.*?)<\/th>/;

const normalize = (s) => String(s).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&")
	.replace(/\*+$/, "").trim().toLowerCase();

/**
 * Swap each generically-rendered value table for one built from the geometric parse.
 *
 * Tables are paired by their first column heading, which is the section name in both — so a table
 * the book prints that we did not parse is left exactly as the pipeline rendered it, and a parsed
 * section the article does not contain is reported rather than silently dropped.
 *
 * @param {(section) => string} renderSection returns the replacement table's HTML
 * @returns {{ html: string, replaced: string[], missing: string[] }}
 */
export function replaceValueTables(html, sections, renderSection) {
	const bySection = new Map(sections.map((s) => [normalize(s.title), s]));
	const replaced = [];
	const out = html.replace(TABLE, (table) => {
		const head = table.match(FIRST_TH);
		if (!head) return table;
		const section = bySection.get(normalize(head[1]));
		if (!section) return table;
		replaced.push(section.title);
		return renderSection(section);
	});
	const missing = sections.map((s) => s.title).filter((t) => !replaced.includes(t));
	return { html: out, replaced, missing };
}

// ─── "If you want to…" topic pages ───────────────────────────────────────────

// The article sets each topic as an <h2>, and prints the heading with the leading ellipsis the
// spread's title supplies ("… gain Surplus", and once without the space: "…improve Defenses").
const TOPIC_HEAD = /<h2[^>]*>([\s\S]*?)<\/h2>/g;
const headingText = (h) => h.replace(/<[^>]+>/g, "").replace(/^[…\s.]+/, "").trim();

/**
 * Split the "If you want to…" article into one section per topic.
 *
 * Each section runs from its own heading to the next, and is paired with the topic key the sheets'
 * ? buttons carry — matched against the book's heading through the SAME declaration build-advice.js
 * uses (advice.js ADVICE_TOPICS), so a reprint that rewords a heading fails in one place rather than
 * silently renaming a key. A heading matching no topic is returned with `key: null` for the caller
 * to report rather than dropped.
 */
/**
 * The anchor a topic's heading is addressed by.
 *
 * Foundry builds a page's table of contents with `slug: heading.id || slugifyHeading(heading)` — so
 * giving the heading an explicit id settles the anchor outright, rather than us having to predict
 * how it would slug the text. That prediction is genuinely hard to get right: slugify runs the
 * heading through a CHAR_MAP first, which rewrites "…" to "..." before lowercasing and collapsing
 * whitespace, so "… improve Prosperity" becomes "...-improve-prosperity" — three literal dots, and
 * nothing about the heading says so.
 */
export const topicAnchor = (key) => `topic-${key}`;

/** Stamp a heading with the id its anchor names, so Foundry's TOC uses it verbatim. */
export function withHeadingId(headingHtml, anchor) {
	return headingHtml.replace(/^<h(\d)\b/, `<h$1 id="${anchor}"`);
}

export function splitTopicPages(html, topics = ADVICE_TOPICS) {
	const heads = [...html.matchAll(TOPIC_HEAD)];
	return heads.map((h, i) => {
		const title = headingText(h[1]);

		const end = i + 1 < heads.length ? heads[i + 1].index : html.length;
		const key = topics.find((t) => t.match.test(title))?.key ?? null;
		const section = html.slice(h.index, end);
		return {
			key,
			title,
			anchor: key ? topicAnchor(key) : null,
			// The heading carries the id its anchor names, so the link cannot miss.
			html: key ? withHeadingId(section, topicAnchor(key)) : section,
		};
	});
}

// ─── gear terms & tags ───────────────────────────────────────────────────────

// The book sets this sidebar as a glossary: each term on its own line, its definition indented under
// it. The column parser has no reason to know that, so it runs the lot together into one paragraph
// — twenty-five terms and definitions in a single block of prose. The terms are rebuilt from
// pdf/tag-glossary.js, which already reads the term/definition split off the book's own typeface.
const TERM_RUN = /<p>(?:(?!<\/p>)[\s\S])*?<\/p>/g;
const isTermRun = (p) => (p.match(/<\/strong>\s*:/g) ?? []).length >= 2;

const escapeText = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One glossary as a definition list. A tag is set in italics, as the book sets it. */
export function renderGlossary(entries) {
	if (!entries.length) return "";
	const rows = entries.map((e) => {
		const term = e.kind === "tag" ? `<em>${escapeText(e.label)}</em>` : escapeText(e.label);
		return `<dt>${term}</dt><dd>${escapeText(e.definition)}</dd>`;
	}).join("");
	return `<dl class="gear-terms">${rows}</dl>`;
}

/**
 * Swap the run-together term paragraphs for proper glossaries — the general terms, then the range
 * tags under their own heading.
 *
 * The lead sentence of the first block explains the load slots ("◇ or ◇◇: it takes up one of
 * these…"). It is not a term/definition pair, so the parser does not carry it; it is lifted out and
 * kept as the paragraph it is rather than lost with the block it sits in.
 */
export function replaceGlossary(html, entries) {
	const at = html.indexOf("<h3>Range Tags</h3>");
	const [head, tail] = at === -1 ? [html, ""] : [html.slice(0, at), html.slice(at)];
	const byCategory = (c) => entries.filter((e) => e.category === c);

	let seen = 0;
	const general = head.replace(TERM_RUN, (p) => {
		if (!isTermRun(p)) return p;
		if (seen++) return "";                                   // a later column of the same run
		const lead = p.slice(3, p.search(/<strong>/)).trim();    // the ◇/□ load-slot sentence
		return (lead ? `<p>${lead}</p>` : "") + renderGlossary(byCategory("general"));
	});

	let seenRange = 0;
	const range = tail.replace(TERM_RUN, (p) => {
		if (!isTermRun(p)) return p;
		return seenRange++ ? "" : renderGlossary(byCategory("range"));
	});
	return general + range;
}

// ─── figures ─────────────────────────────────────────────────────────────────

const FIGURE = /<figure\b[^>]*>[\s\S]*?<\/figure>/g;

/**
 * Drop figures by position — `0` the first, `-1` the last.
 *
 * The article pipeline extracts every illustration a spread carries, including ones that do not
 * belong on a reference page: a chapter's opening plate, or the decorative tailpiece that closes it.
 * Which those are is a judgement about the page, not something the extractor can infer, so the
 * article says which to leave out.
 */
export function dropFigures(html, positions = []) {
	if (!positions.length) return html;
	const figures = [...html.matchAll(FIGURE)];
	const drop = new Set(positions.map((n) => (n < 0 ? figures.length + n : n)));
	let out = html, removed = 0;
	figures.forEach((m, i) => {
		if (!drop.has(i)) return;
		out = out.slice(0, m.index - removed) + out.slice(m.index - removed + m[0].length);
		removed += m[0].length;
	});
	return out;
}

// ─── mark runs ───────────────────────────────────────────────────────────────

// A mark the attacher could not splice becomes its own line, and the renderer joins lines with a
// space — so a run the book prints solid comes out spaced ("( ○ ○ ○ ○ ○ uses)", "◇ ◇"). The marks
// themselves are right; only the whitespace between them is not.
const MARKS = "◇◆○□";
// Tags may sit between a bracket and the run inside it — the renderer closes an emphasis run at each
// line break, so "(" and its marks routinely end up in different elements.
const TAGS = "(?:</?[a-zA-Z][^>]*>)*";
const RUN = new RegExp(`([${MARKS}])(${TAGS})[ \\t]+(?=${TAGS}[${MARKS}])`, "g");
const AFTER_OPEN = new RegExp(`([(\\[])(${TAGS})[ \\t]+(?=${TAGS}[${MARKS}])`, "g");
const BEFORE_CLOSE = new RegExp(`([${MARKS}])(${TAGS})[ \\t]+(?=${TAGS}[),\\].;])`, "g");

// A paragraph or list item of nothing but marks is never content: it is what is left when a mark
// from a figure attaches to no text of its own. The sample insert on "Gear and possessions" reaches
// above the bounds its extracted image reports, so a few of its marks escape the figure filter and
// land as a stray "○○○" of their own.
const MARK_ONLY = new RegExp(`<(p|li)\\b[^>]*>(?:\\s|${TAGS}|[${MARKS}])*</\\1>`, "g");

// A marked slot and the mark it fills are drawn as two things: the dingbat glyph supplies the tick,
// the vector layer supplies the SHAPE. Where that shape is a circle the pair means one checked
// circle — the ammo track's "mark ● all out" — not a checked diamond beside an empty circle.
const CHECKED_CIRCLE = new RegExp(`◆(${TAGS})○|○(${TAGS})◆`, "g");

/** Fold a checked mark and the circle it fills into the single mark the book prints. */
export function mergeCheckedCircles(html) {
	return String(html).replace(CHECKED_CIRCLE, (_, a, b) => `${a ?? b ?? ""}●`);
}

/** Drop paragraphs and items that carry no text — only stray marks. */
export function dropMarkOnlyBlocks(html) {
	return String(html).replace(MARK_ONLY, "").replace(/<ul>\s*<\/ul>/g, "");
}

/** Close up the whitespace inside a run of marks, and around the brackets a run sits in. */
export function collapseMarkRuns(html) {
	return String(html)
		.replace(RUN, "$1$2")
		.replace(AFTER_OPEN, "$1$2")
		.replace(BEFORE_CLOSE, "$1$2");
}

// ─── the Value ladder ────────────────────────────────────────────────────────

// "A Value N item is generally worth:" opens a list of what that Value buys. The parser sees one
// long run of swirl-bulleted lines and makes a single list of the lot — headings bulleted as if they
// were items, and a wrapped item split into a bullet of its own.
const LADDER_LIST = /<ul>((?:(?!<\/ul>)[\s\S])*?)<\/ul>/g;
const LADDER_ITEM = /<li class="swirl">([\s\S]*?)<\/li>/g;
const TIER_HEADING = /^\s*(?:<strong>[\s\S]*?<\/strong>\s*)+[\s\S]*?is generally worth:\s*$/;
// A wrapped line: the book only ever breaks an item mid-phrase, so a continuation opens lower-case
// or on punctuation. A new item opens with a capital or a mark.
const CONTINUATION = /^\s*(?:<\/?[a-zA-Z][^>]*>\s*)*[a-z(),]/;

const plain = (h) => h.replace(/<[^>]+>/g, "").trim();

/**
 * Rebuild the Value ladder as the book sets it: each "A Value N item is generally worth:" a heading
 * of its own, with ONE list under it, and a wrapped line folded back into the item it continues.
 *
 * Applied to the rendered HTML rather than parsed separately, so the ladder keeps the article's own
 * emphasis and the item links already written into it.
 */
export function restructureValueLadder(html) {
	return html.replace(LADDER_LIST, (whole, body) => {
		const items = [...body.matchAll(LADDER_ITEM)].map((m) => m[1]);
		if (!items.some((i) => TIER_HEADING.test(i))) return whole;    // not the ladder

		const out = [];
		let list = [];
		const flush = () => { if (list.length) out.push(`<ul>${list.map((i) => `<li class="swirl">${i}</li>`).join("")}</ul>`); list = []; };
		for (const item of items) {
			if (TIER_HEADING.test(item)) { flush(); out.push(`<p class="value-tier">${item.trim()}</p>`); continue; }
			if (list.length && CONTINUATION.test(item)) { list[list.length - 1] += ` ${item.trim()}`; continue; }
			list.push(item.trim());
		}
		flush();
		return out.join("");
	});
}

// ─── cited rules ─────────────────────────────────────────────────────────────

// The books set the name of a move or a steading improvement in bold when they cite it. advice.js
// links those in MARKDOWN, for the text it used to write into the language file; this is the same
// rule for the HTML the pipeline renders, so a page is a way in to the rules it names rather than a
// dead end. Only a run with no markup inside it is considered — a bold run carrying its own emphasis
// is not a bare name.
const BOLD_HTML = /<strong>([^<]+)<\/strong>/g;

/**
 * Turn every bold name the pack knows into a content link.
 *
 * `uuids` maps an item slug to its UUID (crossref.js loadItemUuidsBySlug). A name nothing matches is
 * left exactly as the book set it.
 */
export function linkBoldNames(html, uuids) {
	if (!uuids?.size) return html;
	return html.replace(BOLD_HTML, (whole, name) => {
		const uuid = uuids.get(toSlug(name.trim().replace(/[.,;:!?]+$/, "")));
		return uuid ? `@UUID[${uuid}]{${name}}` : whole;
	});
}
