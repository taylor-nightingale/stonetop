// Lifting the per-season IMPRESSIONS out of a steading's own article.
//
// Book II's village articles print, under "Impressions", a short list of sensory lines for each
// season — "Petrichor smell on a southerly breeze", "Cloaks drawn tight against a bitter wind". They
// are the book's own words for what the place is like right now, which is exactly what the Season
// tab wants to say when the wheel turns, and exactly the sort of line that must never be invented.
//
// Pure and dependency-free so it can be tested against the real article; the script that writes the
// steadfast is build-steading-impressions.js beside it.
//
// The section's shape, from packs/src/wider-world-and-other-wonders/the-village-of-stonetop.json:
//
//   <h2>Impressions</h2>
//     <h3>Always</h3>       <ul> … </ul>   <p><strong>Activities</strong></p> <ul> … </ul>
//     <h3><img …>Spring</h3><ul> … </ul>   <p><strong>Activities</strong></p> <ul> … </ul>
//     …
//   <h2>Names</h2>
//
// The FIRST <ul> after a season's heading is its impressions; the Activities and Questions lists
// below it are a different thing (chores and prompts, not a description of the place) and are
// deliberately left where they are.

import { Seasons } from "../../src/model/data/steading/Seasons.js";

const SEASON_NAMES = { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" };

/** The Impressions section only — bounded by its own <h2> and whatever <h2> follows it. */
export function impressionsSection(html = "") {
	const start = html.search(/<h2>\s*Impressions\s*<\/h2>/i);
	if (start < 0) return "";
	const rest = html.slice(start + 1);
	const end = rest.search(/<h2>/i);
	return end < 0 ? rest : rest.slice(0, end);
}

// Tags out, entities in, whitespace collapsed. The lines carry <strong>/<em> only incidentally.
function plainText(fragment) {
	return fragment
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
		.replace(/&[a-z]+;/gi, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * The impression lines for one season, in the order the book prints them.
 *
 * Returns [] when the article has no such heading — most steadings have no Impressions section at
 * all, which is ordinary and not a fault.
 */
export function impressionsForSeason(html, seasonKey) {
	const name = SEASON_NAMES[seasonKey];
	if (!name) return [];
	const section = impressionsSection(html);
	// The heading may carry a marker image before the word.
	const heading = new RegExp(`<h3>\\s*(?:<img[^>]*>\\s*)?${name}\\s*</h3>`, "i");
	const at = section.search(heading);
	if (at < 0) return [];

	// The first list after the heading, and only that one.
	const after = section.slice(at);
	const list = after.match(/<ul>([\s\S]*?)<\/ul>/i);
	if (!list) return [];

	return [...list[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
		.map(m => plainText(m[1]))
		.filter(Boolean);
}

/**
 * Every season's impressions as the flat, season-tagged rows the steadfast stores.
 *
 * Flat rather than a field per season so nothing downstream has to spell the four keys: the sheet
 * asks Impressions for the season it is in and gets a list back.
 */
export function impressionsFrom(html) {
	return Seasons.all().flatMap(season =>
		impressionsForSeason(html, season.key).map(text => ({ season: season.key, text })));
}

/** The whole article's text, for an article stored as a journal document with several pages. */
export function articleHtml(doc) {
	return (doc?.pages ?? []).map(page => page?.text?.content ?? "").join("\n");
}
