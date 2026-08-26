import { describe, it, expect } from "vitest";
import { insertItemNames } from "../../../scripts/import/pdf/items.js";

// The Inventory insert (printed p. 142) is the list packs/outfit-items exists to hold. A row is
// identified by its leading ◇/□ in the vector layer, never by its text — which is what lets the
// parser tell "Blanket (warm)" from "For a light load (quick & quiet), mark up to 3 ◇" without a
// hand-maintained list of sentences to ignore. These pin that rule, since getting it wrong once put
// 46 rows of the value tables onto every character sheet in the world.

const REG = "ACaslonPro-Regular";

function line(text, x, y) {
	const xs = [...text].map((_, i) => x + i * 4);
	return { bbox: [x, y, x + text.length * 4, y + 8], text, font: REG, size: 8, spans: [{ font: REG, size: 8, text, xs }] };
}
const page = (...lines) => ({ width: 792, height: 612, lines });
const mark = (x, y, kind = "diamond") => ({ x, y, w: 5, h: 5, kind });

// The insert sets its rows in two columns per half; a gutter is a mark x that several rows share.
const gutter = (x, ys, kind) => ys.map((y) => mark(x, y, kind));

describe("insertItemNames", () => {
	it("reads the rows hanging off a checklist gutter", () => {
		const p = page(line("Blanket (warm)", 33, 200), line("Rope, ~25 ft", 33, 210),
			line("Shovel", 33, 220), line("Snow-shoes", 33, 230));
		const names = insertItemNames(p, gutter(27, [204, 214, 224, 234]));
		expect(names).toEqual(["Blanket", "Rope, ~25 ft", "Shovel", "Snow-shoes"]);
	});

	it("ignores prose, which the book gives no mark", () => {
		const p = page(line("For a light load (quick & quiet), mark up to 3", 45, 60),
			line("Blanket (warm)", 33, 200), line("Rope, ~25 ft", 33, 210),
			line("Shovel", 33, 220), line("Snow-shoes", 33, 230));
		expect(insertItemNames(p, gutter(27, [204, 214, 224, 234])))
			.not.toContain("For a light load");
	});

	// "Oil lamp (○○ hours, close, area, crude)" wraps, and its ○ resource pips sit inline right where
	// the continuation begins — close enough to look like a leading mark until you ask whether anything
	// else lines up underneath them.
	it("ignores a wrapped continuation whose inline ○ pips sit beside it", () => {
		const p = page(line("Oil lamp (", 33, 200), line("hours, close, area, crude)", 83, 200),
			line("Rope, ~25 ft", 33, 210), line("Shovel", 33, 220), line("Snow-shoes", 33, 230));
		const marks = [...gutter(27, [204, 214, 224, 234]), mark(73, 204, "circle"), mark(80, 204, "circle")];
		expect(insertItemNames(p, marks)).toEqual(["Oil lamp", "Rope, ~25 ft", "Shovel", "Snow-shoes"]);
	});

	// Small items are marked □ and load items ◇; both are rows. A second column of either is its own
	// gutter, and the insert sets two of them side by side.
	it("reads both columns and both marks", () => {
		const p = page(line("Awl", 264, 300), line("Bowstring", 323, 300),
			line("Chalk", 264, 310), line("Charcoal", 323, 310),
			line("Clay jar", 264, 320), line("Cup", 323, 320),
			line("Comb", 264, 330), line("Gloves", 323, 330));
		const marks = [...gutter(260, [304, 314, 324, 334], "square"),
			...gutter(318, [304, 314, 324, 334], "square")];
		expect(insertItemNames(p, marks))
			.toEqual(["Awl", "Bowstring", "Chalk", "Charcoal", "Clay jar", "Cup", "Comb", "Gloves"]);
	});

	// The insert shares its spread with the Ranger's Animal Companion sheet, whose rows are marked the
	// same way. Only the left page is the inventory.
	it("stops at the spread's midpoint", () => {
		const p = page(line("Blanket (warm)", 33, 200), line("Rope, ~25 ft", 33, 210),
			line("Shovel", 33, 220), line("Snow-shoes", 33, 230),
			line("Improved damage die", 430, 200), line("Keen senses", 430, 210),
			line("Fleet", 430, 220), line("Tough", 430, 230));
		const marks = [...gutter(27, [204, 214, 224, 234]), ...gutter(424, [204, 214, 224, 234])];
		expect(insertItemNames(p, marks)).toEqual(["Blanket", "Rope, ~25 ft", "Shovel", "Snow-shoes"]);
	});

	// The insert's blank write-in lines carry a mark and no text.
	it("yields nothing for a blank write-in row", () => {
		const p = page(line("Blanket (warm)", 33, 200), line("Rope, ~25 ft", 33, 210),
			line("Shovel", 33, 220), line("Snow-shoes", 33, 230), line("   ", 33, 240));
		expect(insertItemNames(p, gutter(27, [204, 214, 224, 234, 244]))).toHaveLength(4);
	});
});
