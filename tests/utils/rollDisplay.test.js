import { describe, it, expect } from "vitest";
import { RollDisplay } from "../../src/utils/rollDisplay.js";
import { FakeNormalRollBuilder } from "../fakes/FakeNormalRollBuilder.js";
import { FakePoolRollBuilder }  from "../fakes/FakePoolRollBuilder.js";
import { FakeDiceTerm }         from "../fakes/foundry/FakeDiceTerm.js";

// RollDisplay.build now returns the dice VIEW MODEL (data), which move-roll.hbs renders. Game text
// (name/description/resultText) is no longer build()'s job — it's added by the caller as RichText
// and covered by the chat-card integration test.

const display = new RollDisplay(k => k);

const NORMAL = new FakeNormalRollBuilder().withValues(3, 5).withTotal(8).build();
// ADV (3d6kh2): 2 kept + 1 dropped
const ADV = new FakePoolRollBuilder().withKeptGroup(3, 5).withDroppedGroup(2).withTotal(8).build();
// DIS (3d6kl2): 2 kept + 1 dropped
const DIS = new FakePoolRollBuilder().withKeptGroup(2, 4).withDroppedGroup(6).withTotal(6).build();

// The dice are Foundry's own: core computes each die's classes, and the card draws them with core's
// markup and faces. The card used to emit flat numbered chips, sort a 3d6kh2's dropped die into a
// second group behind a "|", and grey it out by hand — which named neither the die's size nor why it
// was dropped, and moved it out of the position it was actually rolled in.
describe("RollDisplay.build — dice", () => {
	it("carries every die of a normal 2d6 roll, in order", () => {
		expect(display.build(NORMAL, {}).rolls.map(r => r.result)).toEqual(["3", "5"]);
	});

	it("carries core's classes, naming the die's size", () => {
		expect(display.build(NORMAL, {}).rolls[0].classes).toContain("d6");
	});

	it("total comes from the roll", () => {
		expect(display.build(NORMAL, {}).total).toBe(8);
	});

	// In place, not sorted to the end: a 3d6kh2 that threw away its middle die threw away its MIDDLE
	// die, and core's own `discarded` is what says so.
	it("marks an advantage roll's dropped die where it fell", () => {
		const v = display.build(ADV, { rollMode: "adv" });
		expect(v.rolls.map(r => r.result)).toEqual(["3", "5", "2"]);
		expect(v.rolls[2].classes).toContain("discarded");
		expect(v.rolls[0].classes).not.toContain("discarded");
	});

	it("marks nothing discarded on a normal roll", () => {
		expect(display.build(NORMAL, {}).rolls.some(r => r.classes.includes("discarded"))).toBe(false);
	});

	// Core's own min/max tinting, which the flat chips had no way to show.
	it("marks the highest and lowest face a die could show", () => {
		const v = display.build(new FakePoolRollBuilder().withKeptGroup(1, 6).withTotal(7).build(), {});
		expect(v.rolls[0].classes).toContain("min");
		expect(v.rolls[1].classes).toContain("max");
	});

	it("carries the dice of every term of the roll", () => {
		const roll = { dice: [FakeDiceTerm.kept([2]), FakeDiceTerm.kept([4, 4])], total: 10 };
		expect(display.build(roll, {}).rolls).toHaveLength(3);
	});
});

describe("RollDisplay.build — mode label", () => {
	it("localized advantage label + rollMode for an adv roll", () => {
		const d = new RollDisplay(k => (k === "stonetop.rollMode.adv" ? "Advantage" : k));
		const v = d.build(ADV, { rollMode: "adv" });
		expect(v.modeLabel).toBe("Advantage");
		expect(v.rollMode).toBe("adv");
	});

	it("localized disadvantage label for a dis roll", () => {
		const d = new RollDisplay(k => (k === "stonetop.rollMode.dis" ? "Disadvantage" : k));
		expect(d.build(DIS, { rollMode: "dis" }).modeLabel).toBe("Disadvantage");
	});

	it("null label for a normal roll", () => {
		expect(display.build(NORMAL, { rollMode: "normal" }).modeLabel).toBeNull();
	});
});

// The modifier is DERIVED — the total, less the dice that counted towards it — rather than passed
// in, because only the stat path used to be told the bonus. A season step's card showed a 1 beside a
// total of 0 and nothing to say where the other −1 went.
describe("RollDisplay.build — modifier", () => {
	const withMod = n => new FakeNormalRollBuilder().withValues(3, 5).withTotal(8 + n).build();

	it("formats a positive modifier with stat name", () => {
		expect(display.build(withMod(2), { statKey: "wis" }).mod).toBe("+2 (WIS)");
	});

	it("formats a negative modifier", () => {
		expect(display.build(withMod(-1), { statKey: "str" }).mod).toBe("-1 (STR)");
	});

	// A rating states itself even at 0: "your WIS is 0" is the answer to why a 7 came out a 7.
	it("formats +0 when the stat is 0", () => {
		expect(display.build(NORMAL, { statKey: "wis" }).mod).toBe("+0 (WIS)");
	});

	// A season step's 1d4+Population, whose card is titled by what the season did — the rating is
	// named on the formula line, so the number alone is what the dice row owes the reader.
	it("formats a bare modifier for a formula roll with no stat", () => {
		expect(display.build(withMod(3), {}).mod).toBe("+3");
	});

	it("formats a bare negative modifier", () => {
		expect(display.build(withMod(-1), {}).mod).toBe("-1");
	});

	// A plain 2d6, or a bare damage die: a "+0" with nothing to attribute it to says nothing at all.
	it("null mod for an unmodified roll with no stat", () => {
		expect(display.build(NORMAL, {}).mod).toBeNull();
	});

	// The dropped die is not part of the total, so it cannot be part of what the total is short by.
	it("ignores discarded dice when deriving the modifier", () => {
		const adv = new FakePoolRollBuilder().withKeptGroup(3, 5).withDroppedGroup(2).withTotal(10).build();
		expect(display.build(adv, { rollMode: "adv", statKey: "dex" }).mod).toBe("+2 (DEX)");
	});

	// The hole the season card had: a title promising "+ Population" over a row that showed nothing
	// where Population went. Anything that NAMED a modifier prints one, zero included.
	it("states a zero modifier when the formula named one", () => {
		expect(display.build(NORMAL, { formula: "1d4 + Population" }).mod).toBe("+0");
	});
});

// The roll as the sheet NAMED it, for a card titled by what the roll did rather than by what it
// rolled — it takes the outcome's place in the readout on a roll that has no tier.
describe("RollDisplay.build — formula", () => {
	it("carries the formula it is handed", () => {
		expect(display.build(NORMAL, { formula: "1d4 + Population" }).formula).toBe("1d4 + Population");
	});

	it("null formula when none is given", () => {
		expect(display.build(NORMAL, {}).formula).toBeNull();
	});
});
