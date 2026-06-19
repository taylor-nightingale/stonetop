import { describe, it, expect } from "vitest";
import { StonetopPlaybook } from "../../src/item/StonetopPlaybook.js";

function makeItem(systemFields = {}) {
	return { system: systemFields };
}

describe("StonetopPlaybook", () => {
	it("hp returns the hp value", () => {
		expect(new StonetopPlaybook(makeItem({ hp: 18 })).hp).toBe(18);
	});

	it("damage returns the damage object", () => {
		expect(new StonetopPlaybook(makeItem({ damage: { die: "d6" } })).damage).toEqual({ die: "d6" });
	});

	it("appearance returns the appearance ChoiceGroup", () => {
		const group = { slug: "appearance", list: [] };
		expect(new StonetopPlaybook(makeItem({ appearance: group })).appearance).toEqual(group);
	});

	it("appearance defaults to null", () => {
		expect(new StonetopPlaybook(makeItem()).appearance).toBeNull();
	});

	it("backgrounds returns the backgrounds array", () => {
		const bgs = [{ slug: "initiate", label: "Initiate" }];
		expect(new StonetopPlaybook(makeItem({ backgrounds: bgs })).backgrounds).toEqual(bgs);
	});

	it("backgrounds defaults to empty array", () => {
		expect(new StonetopPlaybook(makeItem()).backgrounds).toEqual([]);
	});

	it("followers / inserts return the playbook's grant lists, defaulting to []", () => {
		expect(new StonetopPlaybook(makeItem({ followers: ["crew"] })).followers).toEqual(["crew"]);
		expect(new StonetopPlaybook(makeItem({ inserts: ["invoc"] })).inserts).toEqual(["invoc"]);
		expect(new StonetopPlaybook(makeItem()).followers).toEqual([]);
		expect(new StonetopPlaybook(makeItem()).inserts).toEqual([]);
	});

	it("instinct returns the instinct ChoiceGroup", () => {
		const inst = { slug: "instinct", list: [] };
		expect(new StonetopPlaybook(makeItem({ instinct: inst })).instinct).toEqual(inst);
	});

	it("instinct defaults to null", () => {
		expect(new StonetopPlaybook(makeItem()).instinct).toBeNull();
	});

	it("origin returns the origin array", () => {
		const origin = [{ region: "Stonetop", names: ["Arwel"] }];
		expect(new StonetopPlaybook(makeItem({ origin })).origin).toEqual(origin);
	});

	it("origin defaults to empty array", () => {
		expect(new StonetopPlaybook(makeItem()).origin).toEqual([]);
	});

	it("startingMovesNote reads directly from system", () => {
		const item = makeItem({ startingMovesNote: "Pick 2 starting moves." });
		expect(new StonetopPlaybook(item).startingMovesNote).toBe("Pick 2 starting moves.");
	});

	it("startingMovesNote defaults to null", () => {
		expect(new StonetopPlaybook(makeItem()).startingMovesNote).toBeNull();
	});

	it("specialPossessions returns the possessions object", () => {
		const sp = { pickCount: 2, options: [] };
		expect(new StonetopPlaybook(makeItem({ specialPossessions: sp })).specialPossessions).toEqual(sp);
	});

	it("specialPossessions defaults to null", () => {
		expect(new StonetopPlaybook(makeItem()).specialPossessions).toBeNull();
	});

	it("lore returns the lore array", () => {
		const lore = [{ slug: "the-earth-mother", list: [] }];
		expect(new StonetopPlaybook(makeItem({ lore })).lore).toEqual(lore);
	});

	it("lore defaults to empty array", () => {
		expect(new StonetopPlaybook(makeItem()).lore).toEqual([]);
	});
});
