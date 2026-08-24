import { describe, expect, it } from "vitest";
import { RollRequest } from "../../src/actors/RollRequest.js";

// -- helpers -------------------------------------------------------------------

function fakeItem({ name = "Charm Someone", rollStat = "wis", description = "desc", moveResults = null, slug = "charm-someone" } = {}) {
	return {
		name,
		system: { rollStat, description, moveResults, slug },
	};
}

// -- fromStat ------------------------------------------------------------------

describe("RollRequest.fromStat", () => {
	it("sets stat from argument", () => {
		expect(RollRequest.fromStat("wis", "normal").stat).toBe("wis");
	});

	it("sets rollMode from argument", () => {
		expect(RollRequest.fromStat("wis", "adv").rollMode).toBe("adv");
	});

	it("uppercases stat as label", () => {
		expect(RollRequest.fromStat("wis", "normal").label).toBe("WIS");
	});

	it("sets description to empty string", () => {
		expect(RollRequest.fromStat("wis", "normal").description).toBe("");
	});

	it("sets moveResults to null", () => {
		expect(RollRequest.fromStat("wis", "normal").moveResults).toBeNull();
	});

	it("sets moveSlug to null — a bare rating roll is no move", () => {
		expect(RollRequest.fromStat("wis", "normal").moveSlug).toBeNull();
	});
});

// -- fromItem ------------------------------------------------------------------

describe("RollRequest.fromItem", () => {
	it("uses explicit rollStat when provided", () => {
		const req = RollRequest.fromItem(fakeItem({ rollStat: "wis" }), "str", "normal");
		expect(req.stat).toBe("str");
	});

	it("falls back to item.system.rollStat when rollStat arg is null", () => {
		const req = RollRequest.fromItem(fakeItem({ rollStat: "con" }), null, "normal");
		expect(req.stat).toBe("con");
	});

	it("uses item name as label", () => {
		const req = RollRequest.fromItem(fakeItem({ name: "Parley" }), "cha", "normal");
		expect(req.label).toBe("Parley");
	});

	it("copies description from item", () => {
		const req = RollRequest.fromItem(fakeItem({ description: "Roll to persuade" }), "cha", "normal");
		expect(req.description).toBe("Roll to persuade");
	});

	it("copies moveResults from item", () => {
		const results = { success: { value: "They comply." }, partial: { value: "A cost." }, failure: { value: "Bad." } };
		const req = RollRequest.fromItem(fakeItem({ moveResults: results }), "cha", "normal");
		expect(req.moveResults).toBe(results);
	});

	it("defaults description to empty string when absent", () => {
		const item = { name: "Test", system: { rollStat: "str" } };
		expect(RollRequest.fromItem(item, null, "normal").description).toBe("");
	});

	it("defaults moveResults to null when absent", () => {
		const item = { name: "Test", system: { rollStat: "str" } };
		expect(RollRequest.fromItem(item, null, "normal").moveResults).toBeNull();
	});

	it("carries the move's stored slug, for rules scoped to named moves", () => {
		const req = RollRequest.fromItem(fakeItem({ slug: "deploy" }), "defenses", "normal");
		expect(req.moveSlug).toBe("deploy");
	});

	it("defaults moveSlug to null when the item has no slug", () => {
		const item = { name: "Test", system: { rollStat: "str" } };
		expect(RollRequest.fromItem(item, null, "normal").moveSlug).toBeNull();
	});
});

// -- resultText ----------------------------------------------------------------

describe("RollRequest.resultText", () => {
	it("returns the value for the given resultKey when moveResults present", () => {
		const results = { success: { value: "They comply." }, partial: { value: "A cost." }, failure: { value: "Bad." } };
		const req = RollRequest.fromItem(fakeItem({ moveResults: results }), "cha", "normal");
		expect(req.resultText("success")).toBe("They comply.");
		expect(req.resultText("partial")).toBe("A cost.");
	});

	it("returns empty string when moveResults is null", () => {
		expect(RollRequest.fromStat("wis", "normal").resultText("success")).toBe("");
	});

	it("returns empty string when resultKey has no value", () => {
		const results = { success: { value: "ok" } };
		const req = RollRequest.fromItem(fakeItem({ moveResults: results }), "cha", "normal");
		expect(req.resultText("failure")).toBe("");
	});
});

// -- titleFor ------------------------------------------------------------------

describe("RollRequest.titleFor", () => {
	it("item roll: the move's own name, with no stat or outcome baked in", () => {
		const req = RollRequest.fromItem(fakeItem({ name: "Charm Someone", moveResults: {} }), "cha", "normal");
		expect(req.titleFor("cha")).toBe("Charm Someone");
	});

	it("stat roll (no item): the uppercased stat, the only name it has", () => {
		expect(RollRequest.fromStat("wis", "normal").titleFor("wis")).toBe("WIS");
	});

	it("stat roll: names the stat actually rolled, not the one requested", () => {
		expect(RollRequest.fromStat("ask", "normal").titleFor("str")).toBe("STR");
	});
});
