import { describe, it, expect } from "vitest";
import { StonetopPlaybook } from "../../module/item/StonetopPlaybook.js";

function makeItem(stonetopFields = {}) {
	return { flags: { stonetop: stonetopFields } };
}

describe("StonetopPlaybook", () => {
	it("hp returns the hp value", () => {
		expect(new StonetopPlaybook(makeItem({ hp: 18 })).hp).toBe(18);
	});

	it("damage returns the damage string", () => {
		expect(new StonetopPlaybook(makeItem({ damage: "d6" })).damage).toBe("d6");
	});

	it("appearance returns appearance array", () => {
		const opts = [["a", "b"], ["c", "d"]];
		expect(new StonetopPlaybook(makeItem({ appearance: opts })).appearance).toEqual(opts);
	});

	it("appearance defaults to empty array", () => {
		expect(new StonetopPlaybook(makeItem()).appearance).toEqual([]);
	});

	it("backgrounds returns the backgrounds array", () => {
		const bgs = [{ slug: "initiate", label: "Initiate" }];
		expect(new StonetopPlaybook(makeItem({ backgrounds: bgs })).backgrounds).toEqual(bgs);
	});

	it("backgrounds defaults to empty array", () => {
		expect(new StonetopPlaybook(makeItem()).backgrounds).toEqual([]);
	});

	it("instincts returns the instincts array", () => {
		const ins = [{ word: "Delight", description: "..." }];
		expect(new StonetopPlaybook(makeItem({ instincts: ins })).instincts).toEqual(ins);
	});

	it("instincts defaults to empty array", () => {
		expect(new StonetopPlaybook(makeItem()).instincts).toEqual([]);
	});

	it("origin returns the origin array", () => {
		const origin = [{ region: "Stonetop", names: ["Arwel"] }];
		expect(new StonetopPlaybook(makeItem({ origin })).origin).toEqual(origin);
	});

	it("origin defaults to empty array", () => {
		expect(new StonetopPlaybook(makeItem()).origin).toEqual([]);
	});

	it("startingMovesNote reads from moves.startingMovesNote", () => {
		const item = makeItem({ moves: { startingMovesNote: "Pick 2 starting moves." } });
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
		const lore = [{ slug: "the-earth-mother", title: "The Earth Mother", description: "", options: [] }];
		expect(new StonetopPlaybook(makeItem({ lore })).lore).toEqual(lore);
	});

	it("lore defaults to empty array", () => {
		expect(new StonetopPlaybook(makeItem()).lore).toEqual([]);
	});
});
