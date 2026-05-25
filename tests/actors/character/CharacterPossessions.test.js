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

function makeActorOutfitItems() {
	return { sync: vi.fn(async () => {}), deleteBySource: vi.fn(async () => {}) };
}

function makeFakePlaybook(sp = null) {
	return { getData: async () => (sp ? { specialPossessions: sp } : null) };
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

describe("CharacterPossessions — pickValues", () => {
	it("addSubChoice stores the choiceSlug with value 1", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store), makeFakeMoves());
		await cp.addSubChoice("weapons-of-war", "sword");
		expect(store.pickValues).toEqual({ "weapons-of-war": { "sword": 1 } });
	});

	it("addSubChoice is idempotent — calling twice keeps value 1", async () => {
		const store = {};
		const cp = new CharacterPossessions(makeFlags(store), makeFakeMoves());
		await cp.addSubChoice("weapons-of-war", "sword");
		await cp.addSubChoice("weapons-of-war", "sword");
		expect(store.pickValues["weapons-of-war"]["sword"]).toBe(1);
	});

	it("addSubChoice merges with existing pickValues", async () => {
		const store = { pickValues: { "weapons-of-war": { "sword": 1 } } };
		const cp = new CharacterPossessions(makeFlags(store), makeFakeMoves());
		await cp.addSubChoice("weapons-of-war", "crossbow");
		expect(store.pickValues["weapons-of-war"]).toEqual({ "sword": 1, "crossbow": 1 });
	});

	it("removeSubChoice sets the choiceSlug to 0", async () => {
		const store = { pickValues: { "weapons-of-war": { "sword": 1, "crossbow": 1 } } };
		const cp = new CharacterPossessions(makeFlags(store), makeFakeMoves());
		await cp.removeSubChoice("weapons-of-war", "sword");
		expect(store.pickValues["weapons-of-war"]["sword"]).toBe(0);
		expect(store.pickValues["weapons-of-war"]["crossbow"]).toBe(1);
	});

	it("removeSubChoice is safe when slug not previously set", async () => {
		const store = { pickValues: { "weapons-of-war": { "sword": 1 } } };
		const cp = new CharacterPossessions(makeFlags(store), makeFakeMoves());
		await cp.removeSubChoice("weapons-of-war", "battleaxe");
		expect(store.pickValues["weapons-of-war"]["sword"]).toBe(1);
		expect(store.pickValues["weapons-of-war"]["battleaxe"]).toBe(0);
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
	function makeCp(flagStore = {}, sp = null) {
		return new CharacterPossessions(makeFlags(flagStore), makeFakeMoves(), null, makeFakePlaybook(sp));
	}

	it("returns null when specialPossessions is null", async () => {
		expect(await makeCp().buildSnapshot(1)).toBeNull();
	});

	it("returns a PossessionsSnapshot", async () => {
		expect(await makeCp({}, BASE_SP).buildSnapshot(1)).toBeInstanceOf(PossessionsSnapshot);
	});

	it("passes pickCount and pickNote through", async () => {
		const snap = await makeCp({}, BASE_SP).buildSnapshot(1);
		expect(snap.pickCount).toBe(2);
		expect(snap.pickNote).toBe("Pick 2");
	});

	it("all options appear in items", async () => {
		const snap = await makeCp({}, BASE_SP).buildSnapshot(1);
		expect(snap.items).toHaveLength(3);
	});

	it("preselected item is selected, disabled, preselectedSource='Starting'", async () => {
		const snap = await makeCp({}, BASE_SP).buildSnapshot(1);
		const pouch = snap.items.find(i => i.slug === "sacred-pouch");
		expect(pouch.selected).toBe(true);
		expect(pouch.checked).toBe(true);
		expect(pouch.disabled).toBe(true);
		expect(pouch.preselected).toBe(true);
		expect(pouch.preselectedSource).toBe("Starting");
	});

	it("non-preselected, non-selected item is unselected and not disabled", async () => {
		const snap = await makeCp({}, BASE_SP).buildSnapshot(1);
		const apiary = snap.items.find(i => i.slug === "apiary");
		expect(apiary.selected).toBe(false);
		expect(apiary.disabled).toBe(false);
	});

	it("selected (but not preselected) item is selected and not disabled", async () => {
		const store = { selected: ["apiary"] };
		const snap = await makeCp(store, BASE_SP).buildSnapshot(1);
		const apiary = snap.items.find(i => i.slug === "apiary");
		expect(apiary.selected).toBe(true);
		expect(apiary.disabled).toBe(false);
	});

	it("resource on preselected item uses current from uses flag", async () => {
		const store = { uses: { "sacred-pouch": 2 } };
		const snap = await makeCp(store, BASE_SP).buildSnapshot(1);
		const pouch = snap.items.find(i => i.slug === "sacred-pouch");
		expect(pouch.resource.current).toBe(2);
		expect(pouch.resource.max).toBe(3);
	});

	it("resource.current is 0 when item is unselected", async () => {
		const store = { uses: { "apiary": 5 } };
		const snap = await makeCp(store, BASE_SP).buildSnapshot(1);
		const apiary = snap.items.find(i => i.slug === "apiary");
		expect(apiary.resource).toBeNull();
	});

	it("item without resource definition has resource=null", async () => {
		const snap = await makeCp({}, BASE_SP).buildSnapshot(1);
		const apiary = snap.items.find(i => i.slug === "apiary");
		expect(apiary.resource).toBeNull();
	});

	it("level-based uses bonus applies to resource.max", async () => {
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
		const snap = await makeCp({}, sp).buildSnapshot(4);
		const pouch = snap.items.find(i => i.slug === "sacred-pouch");
		expect(pouch.resource.max).toBe(5);
	});
});

// ── syncPossessionItems ───────────────────────────────────────────────────────

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
			choices: {
				slug: "weapons-of-war",
				list: [
					{ type: "pick", pickCount: 1, options: [
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
		},
		{
			slug: "apiary",
			label: "Apiary",
		},
	],
};

describe("CharacterPossessions.syncPossessionItems", () => {
	it("is a no-op when specialPossessions is null", async () => {
		const outfitItems = makeActorOutfitItems();
		const cp = new CharacterPossessions(makeFlags(), makeFakeMoves(), outfitItems);
		await cp.syncPossessionItems("smithy", null);
		expect(outfitItems.sync).not.toHaveBeenCalled();
	});

	it("is a no-op when outfitItems is null", async () => {
		const cp = new CharacterPossessions(makeFlags(), makeFakeMoves(), null);
		await expect(cp.syncPossessionItems("smithy", SP_OUTFIT)).resolves.not.toThrow();
	});

	it("syncs possession-level outfit items with source 'possession:smithy'", async () => {
		const outfitItems = makeActorOutfitItems();
		const cp = new CharacterPossessions(makeFlags(), makeFakeMoves(), outfitItems);
		await cp.syncPossessionItems("smithy", SP_OUTFIT);
		expect(outfitItems.sync).toHaveBeenCalledWith(
			"possession:smithy",
			expect.arrayContaining([
				expect.objectContaining({ flags: expect.objectContaining({ stonetop: expect.objectContaining({ slug: "smithy-tongs", source: "possession:smithy" }) }) }),
				expect.objectContaining({ flags: expect.objectContaining({ stonetop: expect.objectContaining({ slug: "smithy-bellows" }) }) }),
			]),
		);
	});

	it("syncs choice-level outfit item when sub-choice is selected", async () => {
		const store = { selected: ["weapons-of-war"], pickValues: { "weapons-of-war": { "mace": 1 } } };
		const outfitItems = makeActorOutfitItems();
		const cp = new CharacterPossessions(makeFlags(store), makeFakeMoves(), outfitItems);
		await cp.syncPossessionItems("weapons-of-war", SP_OUTFIT);
		expect(outfitItems.sync).toHaveBeenCalledWith(
			"possession:weapons-of-war",
			expect.arrayContaining([
				expect.objectContaining({ flags: expect.objectContaining({ stonetop: expect.objectContaining({ slug: "mace" }) }) }),
			]),
		);
	});

	it("does not include choice outfit item when sub-choice is not selected", async () => {
		const outfitItems = makeActorOutfitItems();
		const cp = new CharacterPossessions(makeFlags({ selected: ["weapons-of-war"] }), makeFakeMoves(), outfitItems);
		await cp.syncPossessionItems("weapons-of-war", SP_OUTFIT);
		const [, items] = outfitItems.sync.mock.calls[0];
		expect(items).toHaveLength(0);
	});

	it("syncs empty array when possession has no outfit items", async () => {
		const outfitItems = makeActorOutfitItems();
		const cp = new CharacterPossessions(makeFlags(), makeFakeMoves(), outfitItems);
		await cp.syncPossessionItems("apiary", SP_OUTFIT);
		expect(outfitItems.sync).toHaveBeenCalledWith("possession:apiary", []);
	});
});

describe("CharacterPossessions — mutation outfitItems integration", () => {
	it("select calls syncPossessionItems with the possession's outfit items", async () => {
		const outfitItems = makeActorOutfitItems();
		const cp = new CharacterPossessions(makeFlags(), makeFakeMoves(), outfitItems);
		await cp.select("smithy", SP_OUTFIT);
		expect(outfitItems.sync).toHaveBeenCalledWith("possession:smithy", expect.any(Array));
	});

	it("deselect calls outfitItems.deleteBySource", async () => {
		const outfitItems = makeActorOutfitItems();
		const store = { selected: ["smithy"] };
		const cp = new CharacterPossessions(makeFlags(store), makeFakeMoves(), outfitItems);
		await cp.deselect("smithy");
		expect(outfitItems.deleteBySource).toHaveBeenCalledWith("possession:smithy");
	});

	it("addSubChoice calls syncPossessionItems", async () => {
		const outfitItems = makeActorOutfitItems();
		const cp = new CharacterPossessions(makeFlags({ selected: ["weapons-of-war"] }), makeFakeMoves(), outfitItems);
		await cp.addSubChoice("weapons-of-war", "mace", SP_OUTFIT);
		expect(outfitItems.sync).toHaveBeenCalledWith("possession:weapons-of-war", expect.any(Array));
	});

	it("removeSubChoice calls syncPossessionItems", async () => {
		const outfitItems = makeActorOutfitItems();
		const store = { selected: ["weapons-of-war"], pickValues: { "weapons-of-war": { "mace": 1 } } };
		const cp = new CharacterPossessions(makeFlags(store), makeFakeMoves(), outfitItems);
		await cp.removeSubChoice("weapons-of-war", "mace", SP_OUTFIT);
		expect(outfitItems.sync).toHaveBeenCalledWith("possession:weapons-of-war", expect.any(Array));
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
			choices: {
				slug: "weapons-of-war",
				list: [
					{ type: "heading", title: "Choose your weapon", note: "pick 1" },
					{ type: "pick", pickCount: 1, options: [
						{ slug: "sword", label: "◇ Sword" },
						{ slug: "axe",   label: "◇ Axe" },
					]},
					{ type: "pick", pickCount: 2, options: [
						{ slug: "shield",  label: "Shield" },
						{ slug: "quiver",  label: "Quiver" },
						{ slug: "hauberk", label: "Hauberk" },
					]},
				],
			},
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
		return new CharacterPossessions(makeFlags(flagStore), makeFakeMoves(), null, makeFakePlaybook(SP_WITH_CHOICES));
	}

	it("choices is null when possession has no choices key", async () => {
		const snap = await makeCp({ selected: ["apiary"] }).buildSnapshot(1);
		const apiary = snap.items.find(i => i.slug === "apiary");
		expect(apiary.choices).toBeNull();
	});

	it("choices is null when possession is not selected", async () => {
		const snap = await makeCp().buildSnapshot(1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		expect(wow.choices).toBeNull();
	});

	it("choices is non-null when possession is selected", async () => {
		const snap = await makeCp({ selected: ["weapons-of-war"] }).buildSnapshot(1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		expect(wow.choices).not.toBeNull();
	});

	it("heading row is a HeadingRow with title and note", async () => {
		const snap = await makeCp({ selected: ["weapons-of-war"] }).buildSnapshot(1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		const headingRow = wow.choices.list[0];
		expect(headingRow.type).toBe("heading");
		expect(headingRow.title).toBe("Choose your weapon");
		expect(headingRow.note).toBe("pick 1");
	});

	it("options row with pickCount 1 has radio=true", async () => {
		const snap = await makeCp({ selected: ["weapons-of-war"] }).buildSnapshot(1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		expect(wow.choices.list[1].radio).toBe(true);
	});

	it("options row with pickCount > 1 has radio=false", async () => {
		const snap = await makeCp({ selected: ["weapons-of-war"] }).buildSnapshot(1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		expect(wow.choices.list[2].radio).toBe(false);
	});

	it("options row has rowKey based on possession slug and row index", async () => {
		const snap = await makeCp({ selected: ["weapons-of-war"] }).buildSnapshot(1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		expect(wow.choices.list[1].rowKey).toBe("weapons-of-war-row-1");
	});

	it("options row has siblingSlugsCsv listing all option slugs", async () => {
		const snap = await makeCp({ selected: ["weapons-of-war"] }).buildSnapshot(1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		expect(wow.choices.list[1].siblingSlugsCsv).toBe("sword,axe");
	});

	it("option checked=true when slug is in pickValues", async () => {
		const snap = await makeCp({ selected: ["weapons-of-war"], pickValues: { "weapons-of-war": { "sword": 1 } } })
			.buildSnapshot(1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		const sword = wow.choices.list[1].options.find(o => o.slug === "sword");
		expect(sword.checked).toBe(true);
	});

	it("option checked=false when slug is not in pickValues", async () => {
		const snap = await makeCp({ selected: ["weapons-of-war"], pickValues: { "weapons-of-war": { "sword": 1 } } })
			.buildSnapshot(1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		const axe = wow.choices.list[1].options.find(o => o.slug === "axe");
		expect(axe.checked).toBe(false);
	});

	it("all rows appear in correct order", async () => {
		const snap = await makeCp({ selected: ["weapons-of-war"] }).buildSnapshot(1);
		const wow = snap.items.find(i => i.slug === "weapons-of-war");
		expect(wow.choices.list).toHaveLength(3);
		expect(wow.choices.list[0].type).toBe("heading");
		expect(wow.choices.list[1].options).toHaveLength(2);
		expect(wow.choices.list[2].options).toHaveLength(3);
	});
});
