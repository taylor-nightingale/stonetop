import { describe, it, expect } from "vitest";
import { OutcomeRange } from "../../../../src/model/data/steading/OutcomeRange.js";
import { ImprovementEffect } from "../../../../src/model/data/steading/ImprovementEffect.js";

/**
 * "if you roll a 7+ with Fortunes" — the book's notation for which results of the season's own roll
 * a clause is waiting for, read as the rows of that roll so the clause can be printed inside them.
 */
describe("OutcomeRange", () => {
	it("reads the book's notations as the rows they cover", () => {
		expect(OutcomeRange.fromRaw("10+").tierKeys).toEqual(["success"]);
		expect(OutcomeRange.fromRaw("7+").tierKeys).toEqual(["success", "partial"]);
		expect(OutcomeRange.fromRaw("7-9").tierKeys).toEqual(["partial"]);
		expect(OutcomeRange.fromRaw("6-").tierKeys).toEqual(["failure"]);
	});

	it("keeps the notation the clause is written in", () => {
		expect(OutcomeRange.fromRaw(" 7+ ").label).toBe("7+");
	});

	it("answers for each row of the roll", () => {
		const sevenUp = OutcomeRange.fromRaw("7+");
		expect(sevenUp.includes("success")).toBe(true);
		expect(sevenUp.includes("partial")).toBe(true);
		expect(sevenUp.includes("failure")).toBe(false);
	});

	/**
	 * A homebrew improvement scoring itself some other way is not outcome-gated at all: the clause
	 * falls back to the advisory list, stated with the book's own clause, which is where every
	 * clause the sheet cannot place goes. Filing it under no row would be the one answer that loses it.
	 */
	it("is nothing at all for a notation it does not know", () => {
		for (const raw of ["12+", "", null, undefined, 7]) expect(OutcomeRange.fromRaw(raw)).toBeNull();
	});
});

describe("a result that waits on one", () => {
	const effect = (outcome) => ImprovementEffect.fromRaw({
		when: { kind: "turn", seasons: ["summer"] },
		change: { target: "surplus", amount: 1 },
		condition: true, outcome,
		text: "the steading generates 1 Surplus",
	});

	it("knows the rows it belongs under", () => {
		expect(effect("7+").isOutcomeGated).toBe(true);
		expect(effect("7+").firesOnTier("success")).toBe(true);
		expect(effect("7+").firesOnTier("failure")).toBe(false);
	});

	it("is not outcome-gated where the notation means nothing", () => {
		expect(effect("whenever").isOutcomeGated).toBe(false);
		expect(effect("whenever").firesOnTier("success")).toBe(false);
	});

	// It is still a condition the sheet cannot evaluate, so nothing about it is ever applied.
	it("is never applied by the sheet", () => {
		expect(effect("7+").isAutomatic).toBe(false);
	});
});
