import { describe, it, expect } from "vitest";
import { addImprovement, removeImprovement } from "../../src/item/steadfastImprovements.js";

describe("addImprovement", () => {
	it("appends a new slug", () => {
		expect(addImprovement(["market"], "mill")).toEqual(["market", "mill"]);
	});

	it("is idempotent — a slug already granted is not duplicated", () => {
		expect(addImprovement(["market", "mill"], "market")).toEqual(["market", "mill"]);
	});

	it("ignores a blank slug", () => {
		expect(addImprovement(["market"], "")).toEqual(["market"]);
		expect(addImprovement(["market"], undefined)).toEqual(["market"]);
	});

	it("returns a new array (does not mutate the input)", () => {
		const input = ["market"];
		const out = addImprovement(input, "mill");
		expect(out).not.toBe(input);
		expect(input).toEqual(["market"]);
	});
});

describe("removeImprovement", () => {
	it("drops the given slug", () => {
		expect(removeImprovement(["market", "mill", "inn"], "mill")).toEqual(["market", "inn"]);
	});

	it("is a no-op when the slug is absent", () => {
		expect(removeImprovement(["market", "mill"], "inn")).toEqual(["market", "mill"]);
	});

	it("returns a new array (does not mutate the input)", () => {
		const input = ["market", "mill"];
		const out = removeImprovement(input, "market");
		expect(out).not.toBe(input);
		expect(input).toEqual(["market", "mill"]);
	});
});
