import { describe, expect, it } from "vitest";
import { RollRequest } from "../../src/actors/RollRequest.js";

// -- helpers -------------------------------------------------------------------

function fakeItem({ name = "Charm Someone", rollStat = "wis", description = "desc", moveResults = null } = {}) {
	return {
		name,
		system: { rollStat, description, moveResults },
	};
}

// -- fromStat ------------------------------------------------------------------

describe("RollRequest.fromStat", () => {
	it("sets stat from argument", () => {
		expect(RollRequest.fromStat("wis", "def").stat).toBe("wis");
	});

	it("sets rollMode from argument", () => {
		expect(RollRequest.fromStat("wis", "adv").rollMode).toBe("adv");
	});

	it("uppercases stat as label", () => {
		expect(RollRequest.fromStat("wis", "def").label).toBe("WIS");
	});

	it("sets description to empty string", () => {
		expect(RollRequest.fromStat("wis", "def").description).toBe("");
	});

	it("sets moveResults to null", () => {
		expect(RollRequest.fromStat("wis", "def").moveResults).toBeNull();
	});
});

// -- fromItem ------------------------------------------------------------------

describe("RollRequest.fromItem", () => {
	it("uses explicit rollStat when provided", () => {
		const req = RollRequest.fromItem(fakeItem({ rollStat: "wis" }), "str", "def");
		expect(req.stat).toBe("str");
	});

	it("falls back to item.system.rollStat when rollStat arg is null", () => {
		const req = RollRequest.fromItem(fakeItem({ rollStat: "con" }), null, "def");
		expect(req.stat).toBe("con");
	});

	it("uses item name as label", () => {
		const req = RollRequest.fromItem(fakeItem({ name: "Parley" }), "cha", "def");
		expect(req.label).toBe("Parley");
	});

	it("copies description from item", () => {
		const req = RollRequest.fromItem(fakeItem({ description: "Roll to persuade" }), "cha", "def");
		expect(req.description).toBe("Roll to persuade");
	});

	it("copies moveResults from item", () => {
		const results = { success: { value: "They comply." }, partial: { value: "A cost." }, failure: { value: "Bad." } };
		const req = RollRequest.fromItem(fakeItem({ moveResults: results }), "cha", "def");
		expect(req.moveResults).toBe(results);
	});

	it("defaults description to empty string when absent", () => {
		const item = { name: "Test", system: { rollStat: "str" } };
		expect(RollRequest.fromItem(item, null, "def").description).toBe("");
	});

	it("defaults moveResults to null when absent", () => {
		const item = { name: "Test", system: { rollStat: "str" } };
		expect(RollRequest.fromItem(item, null, "def").moveResults).toBeNull();
	});
});

// -- resultText ----------------------------------------------------------------

describe("RollRequest.resultText", () => {
	it("returns the value for the given resultKey when moveResults present", () => {
		const results = { success: { value: "They comply." }, partial: { value: "A cost." }, failure: { value: "Bad." } };
		const req = RollRequest.fromItem(fakeItem({ moveResults: results }), "cha", "def");
		expect(req.resultText("success")).toBe("They comply.");
		expect(req.resultText("partial")).toBe("A cost.");
	});

	it("returns empty string when moveResults is null", () => {
		expect(RollRequest.fromStat("wis", "def").resultText("success")).toBe("");
	});

	it("returns empty string when resultKey has no value", () => {
		const results = { success: { value: "ok" } };
		const req = RollRequest.fromItem(fakeItem({ moveResults: results }), "cha", "def");
		expect(req.resultText("failure")).toBe("");
	});
});

// -- buildDisplayName ----------------------------------------------------------

describe("RollRequest.buildDisplayName", () => {
	it("item roll: includes item name and stat label", () => {
		const req = RollRequest.fromItem(fakeItem({ name: "Charm Someone", moveResults: {} }), "cha", "def");
		expect(req.buildDisplayName("cha", "Strong Hit")).toBe("Charm Someone (+CHA) — Strong Hit");
	});

	it("item roll with isPrompt=true: omits stat label", () => {
		const req = RollRequest.fromItem(fakeItem({ name: "Custom Move", moveResults: {} }), "prompt", "def");
		expect(req.buildDisplayName("prompt", "Weak Hit", true)).toBe("Custom Move — Weak Hit");
	});

	it("stat roll (no item): uses stat name only", () => {
		const req = RollRequest.fromStat("wis", "def");
		expect(req.buildDisplayName("wis", "Miss")).toBe("WIS — Miss");
	});
});
