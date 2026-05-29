import { describe, expect, it, vi } from "vitest";
import { CharacterInventory } from "../../../module/actors/character/CharacterInventory.js";
import { OutfitItemBuilder } from "../../../module/model/data/character/OutfitItem.js";
import { FakeInventoryRepository } from "../../fakes/FakeInventoryRepository.js";
import { InventorySnapshot, PossessionsSnapshot } from "../../../module/model/snapshot/character/CharacterSnapshot.js";

// -- Fake helpers ---------------------------------------------------------------

function makeFlags(store = {}) {
	return {
		getFlag: (key) => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => {
			store[key] = val;
		}),
	};
}

function makeOutfitItem(overrides = {}) {
	const labels = overrides.resourceLabels ?? null;
	return new OutfitItemBuilder()
		.withSlug(overrides.slug ?? "test-item")
		.withName(overrides.name ?? "Test Item")
		.withWeight(overrides.weight ?? 1)
		.withNote(overrides.note ?? null)
		.withInventoryColumn(overrides.inventoryColumn ?? "regular")
		.withResource(labels != null ? { max: labels.length, title: null, labels } : (overrides.resource ?? null))
		.withTwoCol(overrides.twoCol ?? false)
		.withGroup(overrides.group ?? null)
		.withOwnedId(overrides.ownedId ?? null)
		.build();
}

function makeRepo(items = []) {
	return new FakeInventoryRepository(items);
}

function makePossessionsFake(snapshot = null) {
	return { buildSnapshot: async () => snapshot };
}

function makeRawEmbeddedItem(overrides = {}) {
	return {
		_id:    overrides._id    ?? "emb-1",
		type:   "equipment",
		name:   overrides.name   ?? "Embedded Item",
		system: { equipmentType: "outfit", weight: overrides.weight ?? 1 },
		flags:  { stonetop: {
			slug:            overrides.slug            ?? null,
			inventoryColumn: overrides.inventoryColumn ?? "regular",
			note:            overrides.note            ?? null,
			resource:        overrides.resource        ?? null,
			twoCol:          overrides.twoCol          ?? false,
			source:          overrides.source          ?? null,
		}},
	};
}

function makeActorOutfitItems(items = []) {
	return {
		getAll:        () => items,
		create:        vi.fn(async () => []),
		deleteById:    vi.fn(async () => []),
		deleteBySource: vi.fn(async () => []),
		sync:          vi.fn(async () => []),
	};
}

function makeCi(flagStore = {}, repo = null, possessions = null, outfitItems = null) {
	return new CharacterInventory(
		makeFlags(flagStore),
		repo ?? makeRepo(),
		possessions ?? makePossessionsFake(),
		outfitItems ?? makeActorOutfitItems(),
	);
}

// Flatten all items across sections for a column
function regularItems(snap) { return snap.outfit.regularSections.flatMap(s => s.items); }
function smallItems(snap)   { return snap.outfit.smallSections.flatMap(s => s.items); }

// -- CharacterInventory -------------------------------------------------------

describe("CharacterInventory", () => {
	it("checked returns {} when no flags set", () => {
		expect(makeCi().checked).toEqual({});
	});

	it("resources returns {} when no flags set", () => {
		expect(makeCi().resources).toEqual({});
	});

	it("setItemChecked stores true for a slug", async () => {
		const store = {};
		const ci = makeCi(store);
		await ci.setItemChecked("supplies", true);
		expect(store.checked).toEqual({ supplies: true });
	});

	it("setItemChecked stores false to uncheck", async () => {
		const store = { checked: { supplies: true } };
		const ci = makeCi(store);
		await ci.setItemChecked("supplies", false);
		expect(store.checked).toEqual({ supplies: false });
	});

	it("setResource stores integer count for a slug", async () => {
		const store = {};
		const ci = makeCi(store);
		await ci.setResource("bow-arrows", 2);
		expect(store.resources).toEqual({ "bow-arrows": 2 });
	});
});

// -- CharacterInventory.calculateArmor ----------------------------------------

function makeArmorItem(slug, armor) {
	return new OutfitItemBuilder()
		.withSlug(slug)
		.withName(slug)
		.withWeight(1)
		.withNote(null)
		.withInventoryColumn("regular")
		.withResource(null)
		.withTwoCol(false)
		.withArmor(armor)
		.build();
}

describe("CharacterInventory.calculateArmor", () => {
	it("returns 0 when no items are checked", () => {
		expect(makeCi().calculateArmor([makeArmorItem("thick-hides", { base: 1 })])).toBe(0);
	});

	it("returns the base value of a single equipped base-armor item", () => {
		const ci = makeCi({ checked: { "thick-hides": true } });
		expect(ci.calculateArmor([makeArmorItem("thick-hides", { base: 1 })])).toBe(1);
	});

	it("uses the highest base when multiple base-armor items are equipped", () => {
		const ci = makeCi({ checked: { "light-armor": true, "heavy-armor": true } });
		const items = [
			makeArmorItem("light-armor", { base: 1 }),
			makeArmorItem("heavy-armor", { base: 3 }),
		];
		expect(ci.calculateArmor(items)).toBe(3);
	});

	it("adds modifier to base when a modifier item is also equipped", () => {
		const ci = makeCi({ checked: { "thick-hides": true, "shield": true } });
		const items = [
			makeArmorItem("thick-hides", { base: 1 }),
			makeArmorItem("shield", { modifier: 1 }),
		];
		expect(ci.calculateArmor(items)).toBe(2);
	});

	it("returns modifier alone when no base item is equipped", () => {
		const ci = makeCi({ checked: { "shield": true } });
		expect(ci.calculateArmor([makeArmorItem("shield", { modifier: 1 })])).toBe(1);
	});

	it("ignores unchecked items", () => {
		const ci = makeCi({ checked: { "thick-hides": false } });
		expect(ci.calculateArmor([makeArmorItem("thick-hides", { base: 1 })])).toBe(0);
	});

	it("ignores items with no armor", () => {
		const ci = makeCi({ checked: { "cloak": true } });
		expect(ci.calculateArmor([makeArmorItem("cloak", null)])).toBe(0);
	});
});

// -- CharacterInventory.getArmor ----------------------------------------------

describe("CharacterInventory.getArmor", () => {
	it("returns 0 when no items are checked", async () => {
		const ci = makeCi({}, makeRepo([makeArmorItem("shield", { base: 1 })]));
		expect(await ci.getArmor()).toBe(0);
	});

	it("returns base armor when item is checked", async () => {
		const ci = makeCi({ checked: { shield: true } }, makeRepo([makeArmorItem("shield", { base: 2 })]));
		expect(await ci.getArmor()).toBe(2);
	});
});

// -- CharacterInventory.buildSnapshot -----------------------------------------

describe("CharacterInventory.buildSnapshot", () => {
	it("returns an InventorySnapshot", async () => {
		const snap = await makeCi().buildSnapshot(1);
		expect(snap).toBeInstanceOf(InventorySnapshot);
	});

	it("regular item from repo appears in regularSections", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "knife", inventoryColumn: "regular" })]);
		const snap = await makeCi({}, repo).buildSnapshot(1);
		expect(regularItems(snap)).toHaveLength(1);
		expect(regularItems(snap)[0].slug).toBe("knife");
	});

	it("checked flag sets item.checked to true", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "knife", inventoryColumn: "regular" })]);
		const snap = await makeCi({ checked: { knife: true } }, repo).buildSnapshot(1);
		expect(regularItems(snap)[0].checked).toBe(true);
	});

	it("unchecked item defaults to false", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "knife", inventoryColumn: "regular" })]);
		const snap = await makeCi({}, repo).buildSnapshot(1);
		expect(regularItems(snap)[0].checked).toBe(false);
	});

	it("resource.current reflects inventory resources flag", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "bow-arrows", inventoryColumn: "regular", resourceLabels: ["low", "out"] })]);
		const snap = await makeCi({ resources: { "bow-arrows": 1 } }, repo).buildSnapshot(1);
		expect(regularItems(snap)[0].resource.current).toBe(1);
	});

	it("item without resource has resource=null", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "knife", inventoryColumn: "regular", resource: null })]);
		const snap = await makeCi({}, repo).buildSnapshot(1);
		expect(regularItems(snap)[0].resource).toBeNull();
	});

	it("items with the same group appear in the same section", async () => {
		const repo = makeRepo([
			makeOutfitItem({ slug: "a", group: "weapons" }),
			makeOutfitItem({ slug: "b", group: "weapons" }),
		]);
		const snap = await makeCi({}, repo).buildSnapshot(1);
		expect(snap.outfit.regularSections).toHaveLength(1);
		expect(snap.outfit.regularSections[0].name).toBe("weapons");
		expect(snap.outfit.regularSections[0].items).toHaveLength(2);
	});

	it("different groups produce separate sections in encounter order", async () => {
		const repo = makeRepo([
			makeOutfitItem({ slug: "a", group: "weapons" }),
			makeOutfitItem({ slug: "b", group: "bedroll" }),
		]);
		const snap = await makeCi({}, repo).buildSnapshot(1);
		expect(snap.outfit.regularSections).toHaveLength(2);
		expect(snap.outfit.regularSections[0].name).toBe("weapons");
		expect(snap.outfit.regularSections[1].name).toBe("bedroll");
	});

	it("embedded items form a trailing section separate from repo items", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "knife", inventoryColumn: "regular" })]);
		const embedded = makeRawEmbeddedItem({ _id: "emb-1", slug: "arcanum-1", source: "arcana:arcanum-1" });
		const snap = await makeCi({}, repo, null, makeActorOutfitItems([embedded])).buildSnapshot(1);
		expect(snap.outfit.regularSections).toHaveLength(2);
		expect(snap.outfit.regularSections[0].items.some(i => i.slug === "knife")).toBe(true);
		expect(snap.outfit.regularSections[1].items.some(i => i.slug === "arcanum-1")).toBe(true);
	});

	it("embedded items are the only section when no repo items exist", async () => {
		const embedded = makeRawEmbeddedItem({ _id: "emb-1", slug: "arcanum-1", source: "arcana:arcanum-1" });
		const snap = await makeCi({}, makeRepo(), null, makeActorOutfitItems([embedded])).buildSnapshot(1);
		expect(snap.outfit.regularSections).toHaveLength(1);
		expect(snap.outfit.regularSections[0].items.some(i => i.slug === "arcanum-1")).toBe(true);
	});

	it("embedded item with no source has isCustom=true and ownedId set", async () => {
		const embedded = makeRawEmbeddedItem({ _id: "custom-1", name: "Custom Item" });
		const snap = await makeCi({}, null, null, makeActorOutfitItems([embedded])).buildSnapshot(1);
		const item = regularItems(snap).find(i => i.slug === "custom-1");
		expect(item.isCustom).toBe(true);
		expect(item.ownedId).toBe("custom-1");
	});

	it("embedded item with source has isCustom=false and ownedId=null", async () => {
		const embedded = makeRawEmbeddedItem({ _id: "emb-1", slug: "arcanum-1", source: "arcana:arcanum-1" });
		const snap = await makeCi({}, null, null, makeActorOutfitItems([embedded])).buildSnapshot(1);
		const item = regularItems(snap).find(i => i.slug === "arcanum-1");
		expect(item.isCustom).toBe(false);
		expect(item.ownedId).toBeNull();
	});

	it("embedded item uses flags.stonetop.slug as slug when present", async () => {
		const embedded = makeRawEmbeddedItem({ _id: "emb-1", slug: "smithy-tongs", source: "possession:smithy" });
		const snap = await makeCi({}, null, null, makeActorOutfitItems([embedded])).buildSnapshot(1);
		expect(regularItems(snap).some(i => i.slug === "smithy-tongs")).toBe(true);
	});

	it("embedded item falls back to _id as slug when no stonetop slug", async () => {
		const embedded = makeRawEmbeddedItem({ _id: "c-2", slug: null });
		const snap = await makeCi({}, null, null, makeActorOutfitItems([embedded])).buildSnapshot(1);
		expect(regularItems(snap).some(i => i.slug === "c-2")).toBe(true);
	});

	it("embedded item in small column appears in smallSections", async () => {
		const embedded = makeRawEmbeddedItem({ _id: "c-3", inventoryColumn: "small" });
		const snap = await makeCi({}, null, null, makeActorOutfitItems([embedded])).buildSnapshot(1);
		expect(smallItems(snap).some(i => i.slug === "c-3")).toBe(true);
	});

	it("small item has twoCol=false when not a grid item", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "chalk", inventoryColumn: "small", twoCol: false })]);
		const snap = await makeCi({}, repo).buildSnapshot(1);
		expect(smallItems(snap)).toHaveLength(1);
		expect(smallItems(snap)[0].slug).toBe("chalk");
		expect(smallItems(snap)[0].twoCol).toBe(false);
	});

	it("small item has twoCol=true when it is a grid item", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "coins", inventoryColumn: "small", twoCol: true })]);
		const snap = await makeCi({}, repo).buildSnapshot(1);
		expect(smallItems(snap)[0].twoCol).toBe(true);
	});

	it("possessions comes from possessions.buildSnapshot", async () => {
		const possSnap = new PossessionsSnapshot(2, "Pick 2", []);
		const snap = await makeCi({}, makeRepo(), makePossessionsFake(possSnap)).buildSnapshot(1);
		expect(snap.possessions).toBe(possSnap);
	});

	it("possessions is null when playbookData is null", async () => {
		const snap = await makeCi().buildSnapshot(1);
		expect(snap.possessions).toBeNull();
	});

	it("load level is null when not set", async () => {
		const snap = await makeCi().buildSnapshot(1);
		expect(snap.outfit.load.selected).toBeNull();
	});

	it("load level reflects loadLevel flag", async () => {
		const snap = await makeCi({ loadLevel: "light" }).buildSnapshot(1);
		expect(snap.outfit.load.loadLevelLight).toBe(true);
		expect(snap.outfit.load.loadLevelNormal).toBe(false);
		expect(snap.outfit.load.loadLevelHeavy).toBe(false);
	});

	it("regularPool.current reflects regularPool flag", async () => {
		const snap = await makeCi({ regularPool: 3 }).buildSnapshot(1);
		expect(snap.outfit.regularPool.current).toBe(3);
	});

	it("smallPool.current reflects smallPool flag", async () => {
		const snap = await makeCi({ smallPool: 5 }).buildSnapshot(1);
		expect(snap.outfit.smallPool.current).toBe(5);
	});
});

// -- CharacterInventory.addCustomItem -----------------------------------------

describe("CharacterInventory.addCustomItem", () => {
	it("calls outfitItems.create with a regular-column item with the given name and weight", async () => {
		const outfitItems = makeActorOutfitItems();
		const ci = makeCi({}, null, null, outfitItems);
		await ci.addCustomItem("Rope", 2);
		expect(outfitItems.create).toHaveBeenCalledWith([
			expect.objectContaining({
				name: "Rope",
				type: "equipment",
				system: expect.objectContaining({ equipmentType: "outfit", weight: 2 }),
				flags: expect.objectContaining({ stonetop: expect.objectContaining({ inventoryColumn: "regular", source: null }) }),
			}),
		]);
	});

	it("clamps weight to minimum 1", async () => {
		const outfitItems = makeActorOutfitItems();
		const ci = makeCi({}, null, null, outfitItems);
		await ci.addCustomItem("Pebble", 0);
		expect(outfitItems.create).toHaveBeenCalledWith([
			expect.objectContaining({ system: expect.objectContaining({ weight: 1 }) }),
		]);
	});
});

// -- CharacterInventory.addCustomSmallItem ------------------------------------

describe("CharacterInventory.addCustomSmallItem", () => {
	it("calls outfitItems.create with a small-column item with the given name", async () => {
		const outfitItems = makeActorOutfitItems();
		const ci = makeCi({}, null, null, outfitItems);
		await ci.addCustomSmallItem("Coin");
		expect(outfitItems.create).toHaveBeenCalledWith([
			expect.objectContaining({
				name: "Coin",
				type: "equipment",
				system: expect.objectContaining({ equipmentType: "outfit" }),
				flags: expect.objectContaining({ stonetop: expect.objectContaining({ inventoryColumn: "small", source: null }) }),
			}),
		]);
	});
});

// -- CharacterInventory.removeCustomItem --------------------------------------

describe("CharacterInventory.removeCustomItem", () => {
	it("calls outfitItems.deleteById with the item id", async () => {
		const outfitItems = makeActorOutfitItems();
		const ci = makeCi({}, null, null, outfitItems);
		await ci.removeCustomItem("item-42");
		expect(outfitItems.deleteById).toHaveBeenCalledWith("item-42");
	});
});
