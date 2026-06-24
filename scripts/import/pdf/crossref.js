// Cross-reference linking: the book cites other articles by printed page number ("(page 307)").
// We harvest each article's printed page numbers during extraction (art.pageNumbers), build a
// printed-page → article-slug map, and rewrite the page numbers in the rendered body into @UUID
// links to the target journal entry. Verbatim text is preserved — only the digits become links.
import { journalUuid } from "./creatures.js";

/**
 * Build a `printedPage → articleSlug` map from `[{slug, pageNumbers}]`. A page can appear in two
 * articles at a spread boundary; first (book-order) writer wins, which keeps the link on the
 * article that actually starts on that page.
 */
export function buildPageMap(articles) {
	const map = new Map();
	for (const { slug, pageNumbers } of articles)
		for (const n of pageNumbers) if (Number.isFinite(n) && !map.has(n)) map.set(n, slug);
	return map;
}

// "page"/"pages" + a number, optionally a range/list ("12-14", "12, 14", "12 or 14") — but NOT a
// following "step N" etc. (the continuation requires a separator immediately before each number).
const PAGE_REF = /\b(pages?)(\s+)(\d+(?:\s*(?:[-–]|,|\bor\b|\band\b)\s*\d+)*)/gi;

/**
 * Rewrite "page N" citations in body HTML into @UUID links to the journal entry whose article
 * contains page N. Each digit run is linked individually (so ranges/lists all link). Pages we
 * didn't import (skipped appendices, maps) and self-references (a page within `selfSlug`) are left
 * as plain text. Returns `{ html, linked }` (count of links made).
 */
export function linkPageRefs(html, pageMap, { selfSlug } = {}) {
	let linked = 0;
	const out = html.replace(PAGE_REF, (whole, word, ws, nums) => {
		const rebuilt = nums.replace(/\d+/g, (num) => {
			const slug = pageMap.get(Number(num));
			if (!slug || slug === selfSlug) return num;
			linked++;
			return `@UUID[${journalUuid(slug)}]{${num}}`;
		});
		return `${word}${ws}${rebuilt}`;
	});
	return { html: out, linked };
}
