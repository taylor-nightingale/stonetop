import { describe, expect, it } from "vitest";
import { RollableStat } from "../../src/actors/RollableStat.js";

describe("RollableStat", () => {
	it("carries the key, the display name and the value", () => {
		const stat = new RollableStat("str", "Strength", 2);
		expect(stat.key).toBe("str");
		expect(stat.name).toBe("Strength");
		expect(stat.value).toBe(2);
	});

	// The tile has room for "STR", not "Constitution" — the same reason the sheet's tiles abbreviate.
	it("is drawn by its abbreviation where it has one", () => {
		expect(new RollableStat("con", "Constitution", 0, "CON").shortName).toBe("CON");
	});

	it("is drawn by its name where it has no abbreviation", () => {
		expect(new RollableStat("fortunes", "Fortunes", 1).shortName).toBe("Fortunes");
	});

	it("signs a positive value", () => {
		expect(new RollableStat("str", "Strength", 2).signedValue).toBe("+2");
	});

	// A rating at 0 still answers "what am I adding?" — it is +0, not a blank.
	it("signs zero as +0", () => {
		expect(new RollableStat("str", "Strength", 0).signedValue).toBe("+0");
	});

	it("leaves a negative value with its own sign", () => {
		expect(new RollableStat("con", "Constitution", -1).signedValue).toBe("-1");
	});

	// The formula line of the roll dialog — the dice before any mode, as rolled +this stat.
	it("is rolled as 2d6 plus its value", () => {
		expect(new RollableStat("int", "Intelligence", 2).rollFormula).toBe("2d6 + 2");
		expect(new RollableStat("int", "Intelligence", 0).rollFormula).toBe("2d6 + 0");
	});

	it("is rolled as 2d6 minus a negative value, with a real minus sign", () => {
		expect(new RollableStat("con", "Constitution", -1).rollFormula).toBe("2d6 \u2212 1");
	});
});
