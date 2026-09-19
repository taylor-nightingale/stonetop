import { describe, it, expect } from "vitest";
import { Advancement } from "../../../../src/model/data/character/Advancement.js";

describe("Advancement", () => {
	it("costs 6 + twice the current level", () => {
		expect(new Advancement(1, 0).cost).toBe(8);
		expect(new Advancement(5, 0).cost).toBe(16);
		expect(new Advancement(10, 0).cost).toBe(26);
	});

	it("triggers at the cost, and past it", () => {
		expect(new Advancement(5, 15).isReady).toBe(false);
		expect(new Advancement(5, 16).isReady).toBe(true);
		expect(new Advancement(5, 19).isReady).toBe(true);
	});

	it("carries the excess over rather than clearing the track", () => {
		expect(new Advancement(5, 19).xpAfter).toBe(3);
		expect(new Advancement(5, 16).xpAfter).toBe(0);
	});

	it("floors the subtraction at zero when advanced early", () => {
		expect(new Advancement(5, 2).xpAfter).toBe(0);
	});

	it("newLevel is the one being bought while the XP is there", () => {
		expect(new Advancement(5, 16).newLevel).toBe(6);
	});

	it("newLevel is the one just bought once the XP is spent", () => {
		expect(new Advancement(6, 3).newLevel).toBe(6);
	});

	it("knows whether the even-level clauses fire", () => {
		expect(new Advancement(5, 16).newLevelIsEven).toBe(true);   // buying 6
		expect(new Advancement(6, 3).newLevelIsEven).toBe(true);    // just bought 6
		expect(new Advancement(6, 18).newLevelIsEven).toBe(false);  // buying 7
	});

	it("expects one chosen move per level gained", () => {
		expect(new Advancement(1, 0).expectedChosenMoves).toBe(0);
		expect(new Advancement(5, 0).expectedChosenMoves).toBe(4);
	});

	it("expects a Lightbearer's starting Invocations plus one per even level", () => {
		expect(new Advancement(1, 0).expectedInvocations(2)).toBe(2);
		expect(new Advancement(2, 0).expectedInvocations(2)).toBe(3);
		expect(new Advancement(5, 0).expectedInvocations(2)).toBe(4);
		expect(new Advancement(6, 0).expectedInvocations(2)).toBe(5);
	});

	it("clamps a level below 1 and negative XP", () => {
		const advancement = new Advancement(0, -5);
		expect(advancement.level).toBe(1);
		expect(advancement.xp).toBe(0);
	});
});
