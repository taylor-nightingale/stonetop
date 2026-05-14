import { describe, it, expect, vi } from "vitest";
import { CharacterPossessions } from "../../../module/actors/character/CharacterPossessions.js";

function makeFlags(store = {}) {
	return {
		getFlag: (key) => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

describe("CharacterPossessions — top-level", () => {
	it("selected returns empty Set when nothing saved", () => {
		const cp = new CharacterPossessions(makeFlags());
		expect(cp.selected.size).toBe(0);
	});

	it("select adds slug to set", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.select("apiary");
		expect(store.selected).toContain("apiary");
	});

	it("deselect removes slug from set", async () => {
		const store = { selected: ["apiary", "mastiffs"] };
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.deselect("apiary");
		expect(store.selected).not.toContain("apiary");
		expect(store.selected).toContain("mastiffs");
	});

	it("setUses stores count under slug key", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.setUses("sacred-pouch", 2);
		expect(store.uses).toEqual({ "sacred-pouch": 2 });
	});
});

describe("CharacterPossessions — subChoices", () => {
	it("subChoices returns empty object when nothing saved", () => {
		const cp = new CharacterPossessions(makeFlags());
		expect(cp.subChoices).toEqual({});
	});

	it("addSubChoice stores the choiceSlug in the possession's array", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.addSubChoice("weapons-of-war", "sword");
		expect(store.subChoices).toEqual({ "weapons-of-war": ["sword"] });
	});

	it("addSubChoice is idempotent — calling twice does not duplicate", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.addSubChoice("weapons-of-war", "sword");
		await cp.addSubChoice("weapons-of-war", "sword");
		expect(store.subChoices["weapons-of-war"]).toHaveLength(1);
	});

	it("addSubChoice appends to an existing array", async () => {
		const store = { subChoices: { "weapons-of-war": ["sword"] } };
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.addSubChoice("weapons-of-war", "crossbow");
		expect(store.subChoices["weapons-of-war"]).toEqual(["sword", "crossbow"]);
	});

	it("removeSubChoice removes the choiceSlug from the array", async () => {
		const store = { subChoices: { "weapons-of-war": ["sword", "crossbow"] } };
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.removeSubChoice("weapons-of-war", "sword");
		expect(store.subChoices["weapons-of-war"]).toEqual(["crossbow"]);
	});

	it("removeSubChoice is safe when slug not in array", async () => {
		const store = { subChoices: { "weapons-of-war": ["sword"] } };
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.removeSubChoice("weapons-of-war", "battleaxe");
		expect(store.subChoices["weapons-of-war"]).toEqual(["sword"]);
	});
});

describe("CharacterPossessions — choiceUses", () => {
	it("choiceUses returns empty object when nothing saved", () => {
		const cp = new CharacterPossessions(makeFlags());
		expect(cp.choiceUses).toEqual({});
	});

	it("setChoiceUses stores count under possessionSlug:choiceSlug key", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.setChoiceUses("weapons-of-war", "crossbow", 1);
		expect(store.choiceUses).toEqual({ "weapons-of-war:crossbow": 1 });
	});

	it("setChoiceUses merges with existing choiceUses", async () => {
		const store = { choiceUses: { "weapons-of-war:sword": 0 } };
		const cp = new CharacterPossessions(makeFlags(store));
		await cp.setChoiceUses("weapons-of-war", "crossbow", 2);
		expect(store.choiceUses).toEqual({ "weapons-of-war:sword": 0, "weapons-of-war:crossbow": 2 });
	});
});
