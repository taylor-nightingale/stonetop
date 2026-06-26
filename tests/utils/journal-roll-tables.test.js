import { describe, expect, it } from "vitest";
import { parseRange, planTableRoll, outcomeFor } from "../../module/utils/journal-roll-tables.js";

// The module's DOM wiring (icon injection, click → chat) is thin; the logic worth
// guarding is the pure trio: how a Roll-cell parses, how the die/label are picked
// from a caption (or inferred), and which row a rolled total lands on.

describe("parseRange", () => {
	it("parses single numbers and ranges (both dash forms)", () => {
		expect(parseRange("1")).toEqual({ lo: 1, hi: 1 });
		expect(parseRange(" 7 ")).toEqual({ lo: 7, hi: 7 });
		expect(parseRange("3-4")).toEqual({ lo: 3, hi: 4 });
		expect(parseRange("11–12")).toEqual({ lo: 11, hi: 12 });
	});

	it("rejects cells that aren't a clean roll value", () => {
		expect(parseRange("5'-8'")).toBeNull();
		expect(parseRange("a chimera")).toBeNull();
		expect(parseRange("")).toBeNull();
	});
});

describe("planTableRoll", () => {
	const rows = [{ lo: 1, hi: 1 }, { lo: 2, hi: 5 }, { lo: 6, hi: 6 }];

	it("takes the die and label from the caption", () => {
		expect(planTableRoll({ captionText: "1d6 encounter", rows }))
			.toEqual({ formula: "1d6", label: "encounter" });
	});

	it("infers a flat 1dN over the highest row when the caption has no formula", () => {
		expect(planTableRoll({ captionText: "", headingText: "Hazards", rows }))
			.toEqual({ formula: "1d6", label: "Hazards" });
	});

	it("falls back to a generic label when there's no caption or heading", () => {
		expect(planTableRoll({ rows }).label).toBe("Random table");
	});
});

describe("outcomeFor", () => {
	const rows = [
		{ lo: 1, hi: 1, html: "one" },
		{ lo: 2, hi: 5, html: "few" },
		{ lo: 6, hi: 6, html: "six" },
	];

	it("returns the html of the row whose range covers the total", () => {
		expect(outcomeFor(rows, 1)).toBe("one");
		expect(outcomeFor(rows, 4)).toBe("few");
		expect(outcomeFor(rows, 6)).toBe("six");
	});

	it("returns null when no row covers the total", () => {
		expect(outcomeFor(rows, 7)).toBeNull();
	});
});
