import { describe, it, expect } from "vitest";
import { startingAttributeNote, formatStartingValue } from "../../../src/actors/steading/startingAttributeNote.js";

// The note reads the immutable startingAttributes baseline, formats the value per attribute, and wraps
// it in the translatable "Starts at {value}" template. It stays empty until a steadfast is applied.
function steading(overrides = {}) {
	return {
		system: {
			steadfast: "stonetop",
			startingAttributes: { fortunes: 1, surplus: 1, size: "village", population: 0, prosperity: -1, defenses: 0 },
			...overrides,
		},
	};
}

describe("formatStartingValue", () => {
	it("signs the ±N ratings, including +0", () => {
		expect(formatStartingValue("fortunes", 1)).toBe("+1");
		expect(formatStartingValue("population", 0)).toBe("+0");
		expect(formatStartingValue("prosperity", -1)).toBe("-1");
		expect(formatStartingValue("defenses", 3)).toBe("+3");
	});

	it("leaves surplus unsigned", () => {
		expect(formatStartingValue("surplus", 1)).toBe("1");
	});

	it("wraps the size tier for emphasis", () => {
		expect(formatStartingValue("size", "village")).toBe("<em>village</em>");
	});
});

describe("startingAttributeNote", () => {
	it("returns the localized note for a signed rating", () => {
		expect(startingAttributeNote(steading(), "prosperity")).toBe("Starts at -1");
		expect(startingAttributeNote(steading(), "population")).toBe("Starts at +0");
	});

	it("returns the localized note for fortunes and surplus", () => {
		expect(startingAttributeNote(steading(), "fortunes")).toBe("Starts at +1");
		expect(startingAttributeNote(steading(), "surplus")).toBe("Starts at 1");
	});

	it("returns the localized note for the size tier", () => {
		expect(startingAttributeNote(steading(), "size")).toBe("Starts at <em>village</em>");
	});

	it("is empty until a steadfast is applied (hidden on a blank steading)", () => {
		expect(startingAttributeNote(steading({ steadfast: "" }), "fortunes")).toBe("");
	});

	it("is empty when the baseline is missing", () => {
		expect(startingAttributeNote({ system: { steadfast: "stonetop" } }, "fortunes")).toBe("");
	});
});
