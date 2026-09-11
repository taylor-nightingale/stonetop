import { describe, it, expect } from "vitest";
import { AppliedStepRoll } from "../../src/model/data/steading/AppliedStepRoll.js";

// What one dice-rolling step of a Seasons Change move did to Surplus. The delta is read from before
// and after rather than from the dice, because consumption floors at 0 — "if there's not enough,
// reduce Surplus to 0" — so a 6 rolled against 2 Surplus spends 2, and 2 is what reverting owes.

describe("AppliedStepRoll", () => {
	it("reads a spend from before and after, not from the dice", () => {
		const applied = new AppliedStepRoll({ total: 6, from: 2, to: 0 });
		expect(applied.delta).toBe(-2);
		expect(applied.amount).toBe(2);
		expect(applied.isSpend).toBe(true);
	});

	it("reads a gain the same way", () => {
		const applied = new AppliedStepRoll({ total: 2, from: 1, to: 3 });
		expect(applied.delta).toBe(2);
		expect(applied.amount).toBe(2);
		expect(applied.isSpend).toBe(false);
	});

	// A roll that moves nothing is neither a spend nor a gain: winter's 1d4+Population comes to 0 with
	// Population at -1, and a stone wall can adjust a 1 down to nothing.
	it("reads a roll that moved nothing as unchanged", () => {
		const applied = new AppliedStepRoll({ total: 0, from: 4, to: 4 });
		expect(applied.delta).toBe(0);
		expect(applied.isUnchanged).toBe(true);
		expect(applied.isSpend).toBe(false);
		expect(new AppliedStepRoll({ total: 3, from: 4, to: 1 }).isUnchanged).toBe(false);
	});

	// The book's answer to a consumption the steading cannot pay is Meet with Disaster, which is the
	// table's to play out — the sheet only says that it happened.
	it("knows when the roll cost more than the steading had", () => {
		expect(new AppliedStepRoll({ total: 6, from: 2, to: 0 }).wasShort).toBe(true);
		expect(new AppliedStepRoll({ total: 2, from: 5, to: 3 }).wasShort).toBe(false);
		expect(new AppliedStepRoll({ total: 2, from: 1, to: 3 }).wasShort).toBe(false);
	});

	// A steading with no Surplus at all pays nothing, so the record moves no number — which is still
	// owing what it owed. Weighed off `to` rather than off being a spend, because it never spent.
	it("is short where there was nothing to take", () => {
		const applied = new AppliedStepRoll({ total: 3, from: 0, to: 0 });
		expect(applied.isSpend).toBe(false);
		expect(applied.wasShort).toBe(true);
	});

	// A gain always lifts Surplus above where it started, so no gain can reach the short branch.
	it("never calls a gain short", () => {
		expect(new AppliedStepRoll({ total: 5, from: 0, to: 5 }).wasShort).toBe(false);
		expect(new AppliedStepRoll({ total: 0, from: 0, to: 0 }).wasShort).toBe(false);
	});

	// What was OWED is not always what the dice said: a stone wall consumes 1 less than winter rolls,
	// and comparing the raw 6 with the 5 that was paid would call every adjusted winter short.
	it("weighs being short against what was owed, not against the dice", () => {
		expect(new AppliedStepRoll({ total: 6, due: 5, from: 5, to: 0 }).wasShort).toBe(false);
		expect(new AppliedStepRoll({ total: 6, due: 5, from: 3, to: 0 }).wasShort).toBe(true);
	});

	it("knows an improvement changed what it cost", () => {
		expect(new AppliedStepRoll({ total: 6, due: 5, from: 9, to: 4 }).wasAdjusted).toBe(true);
		expect(new AppliedStepRoll({ total: 6, from: 9, to: 3 }).wasAdjusted).toBe(false);
	});

	// A record written before the sheet knew about adjustments owed exactly what it rolled.
	it("owes what it rolled where nothing said otherwise", () => {
		expect(new AppliedStepRoll({ total: 4, from: 5, to: 1 }).due).toBe(4);
		expect(AppliedStepRoll.fromRaw({ total: 4, from: 5, to: 1 }).due).toBe(4);
	});

	it("names a spend and a gain differently", () => {
		expect(new AppliedStepRoll({ total: 3, from: 5, to: 2 }).labelKey).toContain("spent");
		expect(new AppliedStepRoll({ total: 3, from: 2, to: 5 }).labelKey).toContain("gained");
	});

	// "Generated 0 Surplus (4 → 4)" is what a zero-delta roll used to read as, because the label was a
	// two-way branch on being a spend and nothing else was.
	it("names a roll that moved nothing as unchanged rather than as a gain", () => {
		expect(new AppliedStepRoll({ total: 0, from: 4, to: 4 }).labelKey).toContain("unchanged");
		expect(new AppliedStepRoll({ total: 1, due: 0, from: 4, to: 4 }).labelKey).toContain("unchanged");
	});

	// Round-trips through the object field it is stored in.
	it("survives storage", () => {
		const applied = new AppliedStepRoll({ total: 4, due: 3, from: 5, to: 2 });
		expect(AppliedStepRoll.fromRaw(applied.toObject())).toEqual(applied);
	});

	it("reads nothing back from a record that is not one", () => {
		expect(AppliedStepRoll.fromRaw(null)).toBeNull();
		expect(AppliedStepRoll.fromRaw({})).toBeNull();
		expect(AppliedStepRoll.fromRaw({ from: 1 })).toBeNull();
	});
});
