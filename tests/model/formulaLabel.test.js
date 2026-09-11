import { describe, it, expect } from "vitest";
import { formulaLabel } from "../../src/model/data/steading/formulaLabel.js";

// FakeI18n's localize returns the key, so a named rating shows up as its own key here. That is the
// house convention for anything that localizes — the point under test is WHICH key, and that the
// `@` is gone.
const POPULATION = "stonetop.steading.attr.population";

describe("formulaLabel — a roll expression in the sheet's own words", () => {
	// The bug: Township's chip read "@population + 1 Surplus".
	it("names the rating a reference points at", () => {
		expect(formulaLabel("@population + 1")).toBe(`${POPULATION}+1`);
	});

	it("leaves a formula with no reference alone", () => {
		expect(formulaLabel("1d4")).toBe("1d4");
	});

	// The book writes "2d6+Population"; three space-separated things read as three things.
	it("closes up the spacing around an operator", () => {
		expect(formulaLabel("2d6 + @population")).toBe(`2d6+${POPULATION}`);
	});

	it("keeps a subtraction as a subtraction", () => {
		expect(formulaLabel("@population - 1")).toBe(`${POPULATION}-1`);
	});

	it("names every reference in an expression that carries two", () => {
		expect(formulaLabel("@population + @defenses"))
			.toBe(`${POPULATION}+stonetop.steading.attr.defenses`);
	});

	// A legible mistake beats a silent one: dropping it would change what the chip claims.
	it("leaves a reference to no known rating exactly as authored", () => {
		expect(formulaLabel("@homebrew + 1")).toBe("@homebrew+1");
	});

	// `rating()` guards by type, so a property of the defaults that is not a rating is not one here.
	it("does not resolve a reference to something that is not a rating", () => {
		expect(formulaLabel("@debilities")).toBe("@debilities");
		expect(formulaLabel("@attributes")).toBe("@attributes");
	});

	it("says nothing for an absent formula", () => {
		expect(formulaLabel(null)).toBe("");
		expect(formulaLabel(undefined)).toBe("");
	});
});
