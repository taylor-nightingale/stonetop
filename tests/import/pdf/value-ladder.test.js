import { describe, it, expect } from "vitest";
import { columnLefts, segmentColumn, parseValueGuide, ValueGuide } from "../../../scripts/import/pdf/value-ladder.js";

// Lines as parseStext yields them. This spread carries no table geometry — structure comes from the
// column grid plus indentation — so each line is placed by (x, y) and given the face it is set in.
const REG = "ACaslonPro-Regular", ITA = "ACaslonPro-Italic", AVARA = "Avara-Bold";

const line = (text, x, y, font = REG) => ({
	bbox: [x, y, x + text.length * 4, y + 9], text, font, size: 9,
	spans: [{ font, size: 9, text, xs: [...text].map((_, i) => x + i * 4) }],
});

const page = (...lines) => ({ width: 792, height: 612, lines });

// A column at `left`: a flush paragraph line, a bulleted item (+5), a wrapped continuation (+13).
const para   = (t, y, left = 204) => line(t, left, y);
const item   = (t, y, left = 204) => line(t, left + 5, y);
const wrap   = (t, y, left = 204) => line(t, left + 13, y);
const tier   = (n, y, left = 204) => para(`A Value ${n} item is generally worth:`, y, left);

describe("columnLefts", () => {
	it("finds the column edges and not every indent level", () => {
		const lines = [para("a", 100), para("b", 111), para("c", 122), item("x", 133), item("y", 144), wrap("z", 155)];
		expect(columnLefts(lines)).toEqual([204]);
	});

	it("separates two columns set a spread apart", () => {
		const lines = [para("a", 100), para("b", 111), para("c", 122),
		               para("d", 100, 432), para("e", 111, 432), para("f", 122, 432)];
		expect(columnLefts(lines)).toEqual([204, 432]);
	});
});

describe("segmentColumn", () => {
	const rows = (...ls) => ls.map((l) => [l]);

	it("classifies flush prose, indented items, and folds a wrap into the item above", () => {
		const blocks = segmentColumn(rows(para("Heading:", 100), item("first", 111), wrap("continued", 122)), 204);
		expect(blocks.map((b) => b.kind)).toEqual(["para", "item"]);
		expect(blocks[1].lines).toHaveLength(2);
	});

	it("runs consecutive flush lines together, and starts a new paragraph across a gap", () => {
		const blocks = segmentColumn(rows(para("one", 100), para("two", 111), para("far", 140)), 204);
		expect(blocks).toHaveLength(2);
		expect(blocks[0].lines).toHaveLength(2);
	});
});

describe("parseValueGuide", () => {
	const ladder = () => page(
		para("Exchange rates are far from standard, but...", 289),
		tier(0, 310), item("A single silver coin", 321), item("A favor", 332),
		tier(1, 386), item("A handful of silver coins", 397),
		tier(2, 440), item("A single gold coin", 451),
	);

	it("collects each rung's equivalences under its Value", () => {
		const guide = parseValueGuide(ladder());
		expect(guide.tiers.map((t) => t.value)).toEqual([0, 1, 2]);
		expect(guide.tiers[0].equivalences).toEqual(["A single silver coin", "A favor"]);
		expect(guide.tiers[1].equivalences).toEqual(["A handful of silver coins"]);
	});

	it("keeps the lead-in sentence out of the rungs", () => {
		expect(parseValueGuide(ladder()).lead).toBe("Exchange rates are far from standard, but...");
	});

	// A column edge is a peak in the line-count histogram, so a realistic column needs several flush
	// lines before it is a column at all — these fixtures give each one the three the page has.
	it("treats prose after the last rung as a note", () => {
		const p = page(
			tier(0, 310), item("A favor", 321),
			tier(1, 386), item("A handful of silver coins", 397),
			para("* Exotic trade goods are +1 Value", 440),
		);
		expect(parseValueGuide(p).notes).toEqual(["* Exotic trade goods are +1 Value"]);
	});

	it("routes the Coins sidebar's prose and bullets into their own section", () => {
		const p = page(
			tier(0, 310), item("A favor", 321),
			tier(1, 386), item("A handful of silver coins", 397),
			tier(2, 440), item("A single gold coin", 451),
			line("Coins", 600, 86, AVARA),
			para("Stonetop doesn't mint coins.", 101, 600),
			para("Coin is used with outsiders.", 112, 600),
			para("Coins vary in size and purity.", 123, 600),
			item("A handful is about 10 coins.", 328, 600),
		);
		const guide = parseValueGuide(p);
		expect(guide.coins.bullets).toEqual(["A handful is about 10 coins."]);
		expect(guide.coins.paragraphs.join(" ")).toContain("Stonetop doesn't mint coins.");
		expect(guide.tiers.map((t) => t.value)).toEqual([0, 1, 2]);
	});

	it("skips the in-fiction example column, which is set wholly in italics", () => {
		const p = page(
			tier(0, 310), item("A favor", 321),
			tier(1, 386), item("A handful of silver coins", 397),
			tier(2, 440), item("A single gold coin", 451),
			line("Sawyl the tanner confirms", 36, 296, ITA),
			line("that the hide is valuable.", 36, 309, ITA),
			line("It's Value 2, says the GM.", 36, 320, ITA),
		);
		const guide = parseValueGuide(p);
		expect(guide.notes).toEqual([]);
		expect(guide.lead).toBe("");
		expect(guide.tiers[0].equivalences).toEqual(["A favor"]);
	});

	it("starts empty", () => {
		expect(new ValueGuide().tiers).toEqual([]);
	});
});
