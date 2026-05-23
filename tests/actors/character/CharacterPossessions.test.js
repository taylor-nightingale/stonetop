import { describe, it, expect, vi } from "vitest";
import { CharacterPossessions } from "../../../module/actors/character/CharacterPossessions.js";
import { PossessionsSnapshot } from "../../../module/model/snapshot/character/CharacterSnapshot.js";

function makeFlags(store = {}) {
	return {
		getFlag: (key) => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

function makeFakeMoves(countByName = {}) {
	return { countOwnedByName: (name) => countByName[name] ?? 0 };
}

describe("CharacterPossessions — top-level", () => {
	it("selected returns empty Set when nothing saved", () => {
		const cp = new CharacterPossessions(makeFlags(), makeFakeMoves());
		expect(cp.selected.size).toBe(0);
	});

	it("select adds slug to set", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store), makeFakeMoves());
		await cp.select("apiary");
		expect(store.selected).toContain("apiary");
	});

	it("deselect removes slug from set", async () => {
		const store = { selected: ["apiary", "mastiffs"] };
		const cp = new CharacterPossessions(makeFlags(store), makeFakeMoves());
		await cp.deselect("apiary");
		expect(store.selected).not.toContain("apiary");
		expect(store.selected).toContain("mastiffs");
	});

	it("setUses stores count under slug key", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store), makeFakeMoves());
		await cp.setUses("sacred-pouch", 2);
		expect(store.uses).toEqual({ "sacred-pouch": 2 });
	});
});

describe("CharacterPossessions — subChoices", () => {
	it("subChoices returns empty object when nothing saved", () => {
		const cp = new CharacterPossessions(makeFlags(), makeFakeMoves());
		expect(cp.subChoices).toEqual({});
	});

	it("addSubChoice stores the choiceSlug in the possession's array", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store), makeFakeMoves());
		await cp.addSubChoice("weapons-of-war", "sword");
		expect(store.subChoices).toEqual({ "weapons-of-war": ["sword"] });
	});

	it("addSubChoice is idempotent — calling twice does not duplicate", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store), makeFakeMoves());
		await cp.addSubChoice("weapons-of-war", "sword");
		await cp.addSubChoice("weapons-of-war", "sword");
		expect(store.subChoices["weapons-of-war"]).toHaveLength(1);
	});

	it("addSubChoice appends to an existing array", async () => {
		const store = { subChoices: { "weapons-of-war": ["sword"] } };
		const cp = new CharacterPossessions(makeFlags(store), makeFakeMoves());
		await cp.addSubChoice("weapons-of-war", "crossbow");
		expect(store.subChoices["weapons-of-war"]).toEqual(["sword", "crossbow"]);
	});

	it("removeSubChoice removes the choiceSlug from the array", async () => {
		const store = { subChoices: { "weapons-of-war": ["sword", "crossbow"] } };
		const cp = new CharacterPossessions(makeFlags(store), makeFakeMoves());
		await cp.removeSubChoice("weapons-of-war", "sword");
		expect(store.subChoices["weapons-of-war"]).toEqual(["crossbow"]);
	});

	it("removeSubChoice is safe when slug not in array", async () => {
		const store = { subChoices: { "weapons-of-war": ["sword"] } };
		const cp = new CharacterPossessions(makeFlags(store), makeFakeMoves());
		await cp.removeSubChoice("weapons-of-war", "battleaxe");
		expect(store.subChoices["weapons-of-war"]).toEqual(["sword"]);
	});
});

describe("CharacterPossessions — choiceUses", () => {
	it("choiceUses returns empty object when nothing saved", () => {
		const cp = new CharacterPossessions(makeFlags(), makeFakeMoves());
		expect(cp.choiceUses).toEqual({});
	});

	it("setChoiceUses stores count under possessionSlug:choiceSlug key", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store), makeFakeMoves());
		await cp.setChoiceUses("weapons-of-war", "crossbow", 1);
		expect(store.choiceUses).toEqual({ "weapons-of-war:crossbow": 1 });
	});

	it("setChoiceUses merges with existing choiceUses", async () => {
		const store = { choiceUses: { "weapons-of-war:sword": 0 } };
		const cp = new CharacterPossessions(makeFlags(store), makeFakeMoves());
		await cp.setChoiceUses("weapons-of-war", "crossbow", 2);
		expect(store.choiceUses).toEqual({ "weapons-of-war:sword": 0, "weapons-of-war:crossbow": 2 });
	});
});

// ── computeMaxUses ────────────────────────────────────────────────────────────

const SP_BONUS = {
	options: [{
		slug: "sacred-pouch",
		resource: { max: 3, title: "Stock", labels: [] },
		usesBonus: {
			evenLevelBonus: 1,
			moveBonus: [{ moveName: "Big Magic", perInstance: 2 }],
		},
	}],
};

describe("CharacterPossessions.computeMaxUses", () => {
	function makeCp(flagStore = {}, countByName = {}) {
		return new CharacterPossessions(makeFlags(flagStore), makeFakeMoves(countByName));
	}

	it("no moves owned, level 1 → no entry (base uses unchanged)", () => {
		const result = makeCp().computeMaxUses(SP_BONUS, 1);
		expect(result["sacred-pouch"]).toBeUndefined();
	});

	it("level 2 → +1 from even level", () => {
		const result = makeCp().computeMaxUses(SP_BONUS, 2);
		expect(result["sacred-pouch"]).toBe(4);
	});

	it("level 4 → +2 from two even levels", () => {
		const result = makeCp().computeMaxUses(SP_BONUS, 4);
		expect(result["sacred-pouch"]).toBe(5);
	});

	it("Big Magic owned once → +2", () => {
		const result = makeCp({}, { "Big Magic": 1 }).computeMaxUses(SP_BONUS, 1);
		expect(result["sacred-pouch"]).toBe(5);
	});

	it("Big Magic owned twice → +4", () => {
		const result = makeCp({}, { "Big Magic": 2 }).computeMaxUses(SP_BONUS, 1);
		expect(result["sacred-pouch"]).toBe(7);
	});

	it("Big Magic once + level 4 → +2 move + +2 level = base 3 + 4", () => {
		const result = makeCp({}, { "Big Magic": 1 }).computeMaxUses(SP_BONUS, 4);
		expect(result["sacred-pouch"]).toBe(7);
	});

	it("possession without usesBonus is not affected", () => {
		const sp = { options: [{ slug: "apiary" }] };
		const result = makeCp().computeMaxUses(sp, 10);
		expect(result["apiary"]).toBeUndefined();
	});

	it("merges flag-based maxUses with computed bonus", () => {
		const store = { maxUses: { "custom-item": 5 } };
		const result = makeCp(store).computeMaxUses(SP_BONUS, 1);
		expect(result["custom-item"]).toBe(5);
		expect(result["sacred-pouch"]).toBeUndefined();
	});
});

// ── buildSnapshot ─────────────────────────────────────────────────────────────

const BASE_SP = {
	pickNote: "Pick 2",
	pickCount: 2,
	preselected: ["sacred-pouch"],
	options: [
		{ slug: "sacred-pouch", label: "Sacred Pouch", description: "magic", resource: { max: 3, title: "Stock", labels: [] } },
		{ slug: "apiary",       label: "Apiary",        description: "bees" },
		{ slug: "mastiffs",     label: "Mastiffs",      description: "dogs" },
	],
};

describe("CharacterPossessions.buildSnapshot", () => {
	function makeCp(flagStore = {}) {
		return new CharacterPossessions(makeFlags(flagStore), makeFakeMoves());
	}

	it("returns null when specialPossessions is null", () => {
		expect(makeCp().buildSnapshot(null, 1)).toBeNull();
	});

	it("returns a PossessionsSnapshot", () => {
		expect(makeCp().buildSnapshot(BASE_SP, 1)).toBeInstanceOf(PossessionsSnapshot);
	});

	it("passes pickCount and pickNote through", () => {
		const snap = makeCp().buildSnapshot(BASE_SP, 1);
		expect(snap.pickCount).toBe(2);
		expect(snap.pickNote).toBe("Pick 2");
	});

	it("all options appear in items", () => {
		const snap = makeCp().buildSnapshot(BASE_SP, 1);
		expect(snap.items).toHaveLength(3);
	});

	it("preselected item is selected, disabled, preselectedSource='Starting'", () => {
		const snap = makeCp().buildSnapshot(BASE_SP, 1);
		const pouch = snap.items.find(i => i.slug === "sacred-pouch");
		expect(pouch.selected).toBe(true);
		expect(pouch.checked).toBe(true);
		expect(pouch.disabled).toBe(true);
		expect(pouch.preselected).toBe(true);
		expect(pouch.preselectedSource).toBe("Starting");
	});

	it("non-preselected, non-selected item is unselected and not disabled", () => {
		const snap = makeCp().buildSnapshot(BASE_SP, 1);
		const apiary = snap.items.find(i => i.slug === "apiary");
		expect(apiary.selected).toBe(false);
		expect(apiary.disabled).toBe(false);
	});

	it("selected (but not preselected) item is selected and not disabled", () => {
		const store = { selected: ["apiary"] };
		const snap = makeCp(store).buildSnapshot(BASE_SP, 1);
		const apiary = snap.items.find(i => i.slug === "apiary");
		expect(apiary.selected).toBe(true);
		expect(apiary.disabled).toBe(false);
	});

	it("resource on preselected item uses current from uses flag", () => {
		const store = { uses: { "sacred-pouch": 2 } };
		const snap = makeCp(store).buildSnapshot(BASE_SP, 1);
		const pouch = snap.items.find(i => i.slug === "sacred-pouch");
		expect(pouch.resource.current).toBe(2);
		expect(pouch.resource.max).toBe(3);
	});

	it("resource.current is 0 when item is unselected", () => {
		const store = { uses: { "apiary": 5 } };
		const snap = makeCp(store).buildSnapshot(BASE_SP, 1);
		const apiary = snap.items.find(i => i.slug === "apiary");
		expect(apiary.resource).toBeNull();
	});

	it("item without resource definition has resource=null", () => {
		const snap = makeCp().buildSnapshot(BASE_SP, 1);
		const apiary = snap.items.find(i => i.slug === "apiary");
		expect(apiary.resource).toBeNull();
	});

	it("level-based uses bonus applies to resource.max", () => {
		const sp = {
			pickNote: "Pick 1",
			pickCount: 1,
			preselected: ["sacred-pouch"],
			options: [{
				slug: "sacred-pouch",
				label: "Sacred Pouch",
				resource: { max: 3, title: "Stock", labels: [] },
				usesBonus: { evenLevelBonus: 1, moveBonus: [] },
			}],
		};
		const snap = makeCp().buildSnapshot(sp, 4);
		const pouch = snap.items.find(i => i.slug === "sacred-pouch");
		expect(pouch.resource.max).toBe(5);
	});
});

// ── getOutfitItems ────────────────────────────────────────────────────────────

const SP_OUTFIT = {
	preselected: [],
	options: [
		{
			slug: "smithy",
			label: "Smithy",
			outfitItems: [
				{ slug: "smithy-tongs",   name: "Tongs",   weight: 1, inventoryColumn: "regular" },
				{ slug: "smithy-bellows", name: "Bellows", weight: 1, inventoryColumn: "regular" },
			],
		},
		{
			slug: "weapons-of-war",
			label: "Weapons of War",
			choices: [
				{ pickCount: 1, options: [
					{
						slug: "mace",
						label: "Mace",
						outfitItems: [{ slug: "mace", name: "Mace", weight: 1, inventoryColumn: "regular", note: "close, forceful" }],
					},
					{
						slug: "crossbow",
						label: "Crossbow",
						outfitItems: [{
							slug: "crossbow",
							name: "Crossbow",
							weight: 1,
							inventoryColumn: "regular",
							note: "far",
							resource: { max: 2, title: null, labels: ["low ammo", "all out"] },
						}],
					},
				]},
			],
		},
		{
			slug: "apiary",
			label: "Apiary",
		},
	],
};

describe("CharacterPossessions.getOutfitItems", () => {
	function makeCp(flagStore = {}) {
		return new CharacterPossessions(makeFlags(flagStore), makeFakeMoves());
	}

	it("returns [] when specialPossessions is null", () => {
		expect(makeCp().getOutfitItems(null)).toEqual([]);
	});

	it("returns possession-level outfit items when possession is selected", () => {
		const cp = makeCp({ selected: ["smithy"] });
		const items = cp.getOutfitItems(SP_OUTFIT);
		expect(items).toHaveLength(2);
		expect(items.map(i => i.slug)).toEqual(["smithy-tongs", "smithy-bellows"]);
	});

	it("returns possession-level outfit items for preselected possessions", () => {
		const sp = { ...SP_OUTFIT, preselected: ["smithy"] };
		const items = makeCp().getOutfitItems(sp);
		expect(items).toHaveLength(2);
		expect(items[0].slug).toBe("smithy-tongs");
	});

	it("does not return outfit items for unselected possessions", () => {
		const items = makeCp().getOutfitItems(SP_OUTFIT);
		expect(items).toHaveLength(0);
	});

	it("returns choice-level outfit item when sub-choice is selected", () => {
		const cp = makeCp({ selected: ["weapons-of-war"], subChoices: { "weapons-of-war": ["mace"] } });
		const items = cp.getOutfitItems(SP_OUTFIT);
		expect(items).toHaveLength(1);
		expect(items[0].slug).toBe("mace");
		expect(items[0].name).toBe("Mace");
	});

	it("does not return choice-level outfit item when sub-choice is not selected", () => {
		const cp = makeCp({ selected: ["weapons-of-war"] });
		const items = cp.getOutfitItems(SP_OUTFIT);
		expect(items).toHaveLength(0);
	});

	it("returns resource-bearing outfit item from a choice", () => {
		const cp = makeCp({ selected: ["weapons-of-war"], subChoices: { "weapons-of-war": ["crossbow"] } });
		const items = cp.getOutfitItems(SP_OUTFIT);
		expect(items).toHaveLength(1);
		const xbow = items[0];
		expect(xbow.slug).toBe("crossbow");
		expect(xbow.resource).not.toBeNull();
		expect(xbow.resource.max).toBe(2);
		expect(xbow.resource.labels).toEqual(["low ammo", "all out"]);
	});

	it("items have correct inventoryColumn and weight", () => {
		const cp = makeCp({ selected: ["smithy"] });
		const items = cp.getOutfitItems(SP_OUTFIT);
		for (const item of items) {
			expect(item.inventoryColumn).toBe("regular");
			expect(item.weight).toBe(1);
		}
	});

	it("possession without outfitItems does not contribute items even if selected", () => {
		const cp = makeCp({ selected: ["apiary"] });
		const items = cp.getOutfitItems(SP_OUTFIT);
		expect(items).toHaveLength(0);
	});

	it("returns choice-level outfit items from array-format choices when sub-choice is selected", () => {
		const cp = makeCp({ selected: ["weapons-of-war"], subChoices: { "weapons-of-war": ["mace"] } });
		const items = cp.getOutfitItems(SP_OUTFIT);
		expect(items).toHaveLength(1);
		expect(items[0].slug).toBe("mace");
	});
});

// ── buildSnapshot — choices ───────────────────────────────────────────────────

const SP_WITH_CHOICES = {
	pickNote: "Pick 1",
	pickCount: 1,
	preselected: [],
	options: [
		{
			slug: "weapons-of-war",
			label: "Weapons of War",
			description: "War stuff",
			choices: [
				{ heading: "Choose your weapon", note: "pick 1" },
				{ pickCount: 1, options: [
					{ slug: "sword", label: "◇ Sword" },
					{ slug: "axe",   label: "◇ Axe" },
				]},
				{ pickCount: 2, options: [
					{ slug: "shield",  label: "Shield" },
					{ slug: "quiver",  label: "Quiver" },
					{ slug: "hauberk", label: "Hauberk" },
				]},
			],
		},
		{
			slug: "apiary",
			label: "Apiary",
			description: "Bees",
		},
	],
};

describe("CharacterPossessions.buildSnapshot — choices", () => {
	function makeCp(flagStore = {}) {
		return new CharacterPossessions(makeFlags(flagStore), makeFakeMoves());
	}

	it("choices is null when possession has no choices key", () => {
		const snap = makeCp({ selected: ["apiary"] }).buildSnapshot(SP_WITH_CHOICES, 1);
		const apiary = snap.items.find(i => i.slug === "apiary");
		expect(apiary.choices).toBeNull();
	});

	it("choices is null when possession is not selected", () => {
		const snap = makeCp().buildSnapshot(SP_WITH_CHOICES, 1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		expect(wow.choices).toBeNull();
	});

	it("choices is non-null when possession is selected", () => {
		const snap = makeCp({ selected: ["weapons-of-war"] }).buildSnapshot(SP_WITH_CHOICES, 1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		expect(wow.choices).not.toBeNull();
	});

	it("heading row passes through with heading and note, no options", () => {
		const snap = makeCp({ selected: ["weapons-of-war"] }).buildSnapshot(SP_WITH_CHOICES, 1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		const headingRow = wow.choices[0];
		expect(headingRow.heading).toBe("Choose your weapon");
		expect(headingRow.note).toBe("pick 1");
		expect(headingRow.options).toBeUndefined();
	});

	it("options row with pickCount 1 has radio=true", () => {
		const snap = makeCp({ selected: ["weapons-of-war"] }).buildSnapshot(SP_WITH_CHOICES, 1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		expect(wow.choices[1].radio).toBe(true);
	});

	it("options row with pickCount > 1 has radio=false", () => {
		const snap = makeCp({ selected: ["weapons-of-war"] }).buildSnapshot(SP_WITH_CHOICES, 1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		expect(wow.choices[2].radio).toBe(false);
	});

	it("options row has groupId based on possession slug and row index", () => {
		const snap = makeCp({ selected: ["weapons-of-war"] }).buildSnapshot(SP_WITH_CHOICES, 1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		expect(wow.choices[1].groupId).toBe("weapons-of-war-row-1");
	});

	it("options row has slugsCsv listing all option slugs", () => {
		const snap = makeCp({ selected: ["weapons-of-war"] }).buildSnapshot(SP_WITH_CHOICES, 1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		expect(wow.choices[1].slugsCsv).toBe("sword,axe");
	});

	it("option checked=true when slug is in subChoices", () => {
		const snap = makeCp({ selected: ["weapons-of-war"], subChoices: { "weapons-of-war": ["sword"] } })
			.buildSnapshot(SP_WITH_CHOICES, 1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		const sword = wow.choices[1].options.find(o => o.slug === "sword");
		expect(sword.checked).toBe(true);
	});

	it("option checked=false when slug is not in subChoices", () => {
		const snap = makeCp({ selected: ["weapons-of-war"], subChoices: { "weapons-of-war": ["sword"] } })
			.buildSnapshot(SP_WITH_CHOICES, 1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		const axe = wow.choices[1].options.find(o => o.slug === "axe");
		expect(axe.checked).toBe(false);
	});

	it("all rows appear in correct order", () => {
		const snap = makeCp({ selected: ["weapons-of-war"] }).buildSnapshot(SP_WITH_CHOICES, 1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		expect(wow.choices).toHaveLength(3);
		expect(wow.choices[0].heading).toBeDefined();
		expect(wow.choices[1].options).toHaveLength(2);
		expect(wow.choices[2].options).toHaveLength(3);
	});
});
