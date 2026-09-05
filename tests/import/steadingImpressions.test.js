import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { articleHtml, impressionsForSeason, impressionsFrom, impressionsSection } from "../../scripts/import/steadingImpressions.js";

// Against the REAL article, because that is what the pass parses. These lines are the book's own
// words and the Season tab quotes them verbatim — a fixture here would let the extractor drift away
// from the file it actually reads and still pass.

const ARTICLE = "packs/src/wider-world-and-other-wonders/the-village-of-stonetop.json";
const html = articleHtml(JSON.parse(readFileSync(ARTICLE, "utf8")));

describe("the Impressions section", () => {
	it("is bounded by its own heading and the next one", () => {
		const section = impressionsSection(html);
		expect(section).toContain("Petrichor smell");
		// "Names" is the <h2> that follows it; nothing from there on belongs to Impressions.
		expect(section).not.toContain("Welsh and Welsh-inspired");
	});

	it("is empty for an article that prints no such section", () => {
		expect(impressionsSection("<h2>Names</h2><p>Aderyn</p>")).toBe("");
	});
});

describe("the lines lifted per season", () => {
	// Every line the book prints for spring, in its order — including the first, which is the one an
	// eye skims past.
	it("takes every spring line, in the book's order", () => {
		expect(impressionsForSeason(html, "spring")).toEqual([
			"Drip drip drip of snow melting from roofs, collecting in jugs and puddles",
			"Petrichor smell on a southerly breeze",
			"Hopeful green poking through deadbrown grass and soil",
			"Bare skin reveling in the still-chilly sun; cheerful voices; smiles and songs",
		]);
	});

	// The seasons print different numbers of lines; summer and winter have five, not four.
	it("takes all five where the book prints five", () => {
		expect(impressionsForSeason(html, "summer")).toHaveLength(5);
		expect(impressionsForSeason(html, "winter")).toHaveLength(5);
		expect(impressionsForSeason(html, "summer")).toContain(
			"CRACKOOM of thunder, blinding flash as lightning touches the Stone");
		expect(impressionsForSeason(html, "winter")).toContain("Yeasty smell of fermenting barley");
	});

	it("reads a heading that carries a marker image", () => {
		expect(impressionsForSeason(html, "autumn")[0])
			.toBe("Crops bobbing heavy with seed, the Great Wood aflame with color");
	});

	// The FIRST list after a season heading is its impressions. The Activities and Questions lists
	// below it are chores and table prompts — a different thing, and taking them would put "Spreading
	// manure & plowing fallow fields" in a panel describing what spring is like.
	it("stops at the impressions and never reaches the Activities list", () => {
		const spring = impressionsForSeason(html, "spring");
		expect(spring.some(line => /manure|Harrowing|Chasing birds/.test(line))).toBe(false);
		expect(spring.some(line => /Questions|look forward/.test(line))).toBe(false);
	});

	// The "Always" list is real but is not seasonal, so nothing claims it for a season.
	it("does not attribute the Always lines to a season", () => {
		const all = impressionsFrom(html).map(r => r.text);
		expect(all.some(line => /tingling, slight smell of ozone/.test(line))).toBe(false);
	});

	it("has nothing for a season the article does not name", () => {
		expect(impressionsForSeason("<h2>Impressions</h2><h3>Spring</h3><ul><li>A line</li></ul>", "winter")).toEqual([]);
	});

	it("has nothing for a value that is not a season", () => {
		expect(impressionsForSeason(html, "harvestide")).toEqual([]);
	});
});

describe("the rows written to the steadfast", () => {
	it("tags every line with its season, in the book's order", () => {
		const rows = impressionsFrom(html);
		expect(rows).toHaveLength(18);
		expect(rows[0]).toEqual({
			season: "spring",
			text: "Drip drip drip of snow melting from roofs, collecting in jugs and puddles",
		});
		expect([...new Set(rows.map(r => r.season))]).toEqual(["spring", "summer", "autumn", "winter"]);
	});

	// Most articles print no Impressions section at all; that is ordinary, not a fault.
	it("is empty for an article with no such section", () => {
		expect(impressionsFrom("<h2>Names</h2><p>Aderyn</p>")).toEqual([]);
	});

	// The lines carry markup incidentally; what reaches the sheet is text.
	it("strips markup and decodes entities", () => {
		const rows = impressionsFrom(
			"<h2>Impressions</h2><h3>Spring</h3><ul><li class='swirl'>Rain &amp; <strong>wind</strong></li></ul>");
		expect(rows).toEqual([{ season: "spring", text: "Rain & wind" }]);
	});
});
