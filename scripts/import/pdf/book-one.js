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

import { loadOutline } from "./outline.js";
import { loadArticlePages } from "./load.js";
import { extractArticle } from "./layout.js";
import { renderHtml } from "./render-html.js";

/** An article's page range, taken from Book I's own outline entry. The spread sits below a chapter,
 *  and its end is the page before whatever the outline lists next. */
export function articleRange(outline, title) {
	const at = outline.findIndex((e) => new RegExp(`^${title}`, "i").test(e.title));
	if (at < 0) throw new Error(`Book I outline has no "${title}" entry`);
	const next = outline.slice(at + 1).find((e) => e.pdfPage > outline[at].pdfPage);
	if (!next) throw new Error(`"${title}" is the last outline entry — cannot bound it`);
	return { title: outline[at].title, pdfPage: outline[at].pdfPage, endPage: next.pdfPage - 1 };
}

/**
 * Text drawn INSIDE a figure is part of the picture, not the article.
 *
 * "Gear and possessions" prints a filled-in sample of the Inventory insert across its opening
 * spread (printed pp. 86-87), and that sample is a form full of words — item names, load marks, the
 * lot. The extractor has no way to know they are not prose, so they arrive interleaved with the real
 * columns ("Mattock, iron (close, x piercing, messy, awk Maul, iron (close forc f l Staff ( l").
 *
 * A line whose middle falls within an extracted image's bounds is dropped. Centre rather than full
 * containment: it clears the sample's fragments, which full containment leaves behind. The cost is
 * that a real sentence running under a figure's edge can go with them — accepted, because the
 * sample insert is the character sheet's Inventory tab and is not content this page needs.
 */
export function dropFigureText(page, images = []) {
	if (!images.length) return page;
	const inside = (l) => {
		const mx = (l.bbox[0] + l.bbox[2]) / 2, my = (l.bbox[1] + l.bbox[3]) / 2;
		return images.some((im) => mx >= im.x && mx <= im.x + im.w && my >= im.y && my <= im.y + im.h);
	};
	return { ...page, lines: page.lines.filter((l) => !inside(l)) };
}

/**
 * Render one Book I article to HTML, with its images extracted into `imgDir`.
 *
 * `figureText: false` drops text that sits inside a figure — see dropFigureText. It is the default
 * because Book I illustrates its rules with filled-in samples of the sheets they describe.
 */
export function renderArticle(pdf, range, { imgDir, imgPrefix, mapFile, dedup, figureText = false } = {}) {
	const { pages, pageRules, pageImages } =
		loadArticlePages(pdf, range, { imgDir, imgPrefix, mapFile, dedup, markers: false });
	const clean = figureText ? pages : pages.map((pg, i) => dropFigureText(pg, pageImages[i]));
	const article = extractArticle(clean, { title: range.title, pageRules, pageImages });
	return { article, html: renderHtml(article), pageNumbers: article.pageNumbers };
}

export const loadBookOneOutline = (pdf) => loadOutline(pdf);

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
