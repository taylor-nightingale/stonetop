import { describe, it, expect } from "vitest";
import { parseArmorBoost, armorBoostLabel } from "../../module/utils/monster-armor-boost.js";

describe("parseArmorBoost", () => {
	it("reads an 'Armor N' boost after the word", () => {
		expect(parseArmorBoost("Withdraw into its shell (Armor 5)")).toBe(5);
		expect(parseArmorBoost("Hunker down, Armor: 4")).toBe(4);
	});

	it("reads an 'N armor' boost before the word", () => {
		expect(parseArmorBoost("Curl up into a ball of hard, jagged scales (4 armor)")).toBe(4);
	});

	it("does not treat numberless armor mentions as a boost", () => {
		expect(parseArmorBoost("Belch a bolt of lightning (near, forceful, ignores armor)")).toBeNull();
		expect(parseArmorBoost("Rip things apart: armor, weapons, flesh")).toBeNull();
		expect(parseArmorBoost("Reach through armor, clothing, flesh, and bone")).toBeNull();
	});

	it("does not pick up a distant damage die as the armor value", () => {
		expect(parseArmorBoost("Engulf, d10+3 damage with advantage (hand, messy, ignores armor)")).toBeNull();
	});

	it("does not treat a hyphenated 'armor-…' compound as a boost", () => {
		expect(parseArmorBoost("Strikes for 3 armor-piercing damage")).toBeNull();
		expect(parseArmorBoost("Rake with 2 armor-rending claws")).toBeNull();
		expect(parseArmorBoost("Anti-armor 4 round")).toBeNull();
	});

	it("returns null for ordinary moves and empty input", () => {
		expect(parseArmorBoost("Burrow into soil")).toBeNull();
		expect(parseArmorBoost("")).toBeNull();
		expect(parseArmorBoost(null)).toBeNull();
		expect(parseArmorBoost(undefined)).toBeNull();
	});
});

describe("armorBoostLabel", () => {
	it("strips a trailing armor parenthetical so the label reads as the action", () => {
		expect(armorBoostLabel("Withdraw into its shell (Armor 5)")).toBe("Withdraw into its shell");
		expect(armorBoostLabel("Curl up into a ball of hard, jagged scales (4 armor)"))
			.toBe("Curl up into a ball of hard, jagged scales");
	});

	it("leaves a name that states the boost without a parenthetical unchanged", () => {
		expect(armorBoostLabel("Hunker down, Armor: 4")).toBe("Hunker down, Armor: 4");
	});

	it("never returns an empty label", () => {
		expect(armorBoostLabel("(Armor 5)")).toBe("(Armor 5)");
	});
});
