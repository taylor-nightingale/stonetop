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
		.withSmallGrid(overrides.smallGrid ?? false)
		.withBreakBefore(overrides.breakBefore ?? false)
		.withOwnedId(overrides.ownedId ?? null)
		.build();
}

function makeRepo(items = []) {
	return new FakeInventoryRepository(items);
}

function makeFakePlaybook(data = null) {
	return { getData: async () => data };
}

function makePossessionsFake(snapshot = null, outfitItems = []) {
	return {
		buildSnapshot: () => snapshot,
		getOutfitItems: () => outfitItems,
	};
}

function makeActor(items = []) {
	return {
		items,
		createEmbeddedDocuments: vi.fn(async () => []),
		deleteEmbeddedDocuments: vi.fn(async () => []),
	};
}

function makeCi(flagStore = {}, repo = null, possessions = null, actor = null, playbook = null) {
	return new CharacterInventory(
		makeFlags(flagStore),
		repo ?? makeRepo(),
		possessions ?? makePossessionsFake(),
		actor ?? makeActor(),
		playbook ?? makeFakePlaybook(),
	);
}

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
		.withSmallGrid(false)
		.withBreakBefore(false)
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
		const snap = await makeCi().buildSnapshot();
		expect(snap).toBeInstanceOf(InventorySnapshot);
	});

	it("regular item from repo appears in outfit.regularItems", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "knife", inventoryColumn: "regular" })]);
		const snap = await makeCi({}, repo).buildSnapshot();
		expect(snap.outfit.regularItems).toHaveLength(1);
		expect(snap.outfit.regularItems[0].slug).toBe("knife");
	});

	it("checked flag sets item.checked to true", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "knife", inventoryColumn: "regular" })]);
		const snap = await makeCi({ checked: { knife: true } }, repo).buildSnapshot();
		expect(snap.outfit.regularItems[0].checked).toBe(true);
	});

	it("unchecked item defaults to false", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "knife", inventoryColumn: "regular" })]);
		const snap = await makeCi({}, repo).buildSnapshot();
		expect(snap.outfit.regularItems[0].checked).toBe(false);
	});

	it("resource.current reflects inventory resources flag", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "bow-arrows", inventoryColumn: "regular", resourceLabels: ["low", "out"] })]);
		const snap = await makeCi({ resources: { "bow-arrows": 1 } }, repo).buildSnapshot();
		expect(snap.outfit.regularItems[0].resource.current).toBe(1);
	});

	it("item without resource has resource=null", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "knife", inventoryColumn: "regular", resource: null })]);
		const snap = await makeCi({}, repo).buildSnapshot();
		expect(snap.outfit.regularItems[0].resource).toBeNull();
	});

	it("custom regular item from actor.items appears in outfit.regularItems", async () => {
		const actorItem = { _id: "custom-1", type: "equipment", name: "Custom Item",
			system: { equipmentType: "inventory-custom", inventoryColumn: "regular", weight: 2 } };
		const snap = await makeCi({}, null, null, makeActor([actorItem])).buildSnapshot();
		expect(snap.outfit.regularItems.some(i => i.slug === "custom-1")).toBe(true);
	});

	it("custom item has isCustom=true and ownedId set", async () => {
		const actorItem = { _id: "custom-1", type: "equipment", name: "Custom Item",
			system: { equipmentType: "inventory-custom", inventoryColumn: "regular", weight: 2 } };
		const snap = await makeCi({}, null, null, makeActor([actorItem])).buildSnapshot();
		const item = snap.outfit.regularItems.find(i => i.slug === "custom-1");
		expect(item.isCustom).toBe(true);
		expect(item.ownedId).toBe("custom-1");
	});

	it("arcana regular item injected via setArcanaItems appears in outfit.regularItems", async () => {
		const ci = makeCi({}, makeRepo());
		ci.setArcanaItems([makeOutfitItem({ slug: "arcanum-1", inventoryColumn: "regular" })]);
		const snap = await ci.buildSnapshot();
		expect(snap.outfit.regularItems.some(i => i.slug === "arcanum-1")).toBe(true);
	});

	it("small items appear in outfit.smallItems", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "chalk", inventoryColumn: "small", smallGrid: false })]);
		const snap = await makeCi({}, repo).buildSnapshot();
		expect(snap.outfit.smallItems).toHaveLength(1);
		expect(snap.outfit.smallItems[0].slug).toBe("chalk");
	});

	it("smallGrid items appear in outfit.smallGridItems", async () => {
		const repo = makeRepo([makeOutfitItem({ slug: "coins", inventoryColumn: "small", smallGrid: true })]);
		const snap = await makeCi({}, repo).buildSnapshot();
		expect(snap.outfit.smallGridItems).toHaveLength(1);
		expect(snap.outfit.smallGridItems[0].slug).toBe("coins");
	});

	it("possessions comes from possessions.buildSnapshot", async () => {
		const possSnap = new PossessionsSnapshot(2, "Pick 2", []);
		const playbookData = { specialPossessions: { pickCount: 2, pickNote: "Pick 2", options: [] } };
		const snap = await makeCi({}, makeRepo(), makePossessionsFake(possSnap), null, makeFakePlaybook(playbookData))
			.buildSnapshot();
		expect(snap.possessions).toBe(possSnap);
	});

	it("possessions is null when playbookData is null", async () => {
		const snap = await makeCi().buildSnapshot();
		expect(snap.possessions).toBeNull();
	});

	it("load level is null when not set", async () => {
		const snap = await makeCi().buildSnapshot();
		expect(snap.outfit.load.selected).toBeNull();
	});

	it("load level reflects loadLevel flag", async () => {
		const snap = await makeCi({ loadLevel: "light" }).buildSnapshot();
		expect(snap.outfit.load.loadLevelLight).toBe(true);
		expect(snap.outfit.load.loadLevelNormal).toBe(false);
		expect(snap.outfit.load.loadLevelHeavy).toBe(false);
	});

	it("regularPool.current reflects regularPool flag", async () => {
		const snap = await makeCi({ regularPool: 3 }).buildSnapshot();
		expect(snap.outfit.regularPool.current).toBe(3);
	});

	it("smallPool.current reflects smallPool flag", async () => {
		const snap = await makeCi({ smallPool: 5 }).buildSnapshot();
		expect(snap.outfit.smallPool.current).toBe(5);
	});

	it("regularSegments splits twoCol and list items into separate groups", async () => {
		const repo = makeRepo([
			makeOutfitItem({ slug: "a", inventoryColumn: "regular", twoCol: false }),
			makeOutfitItem({ slug: "b", inventoryColumn: "regular", twoCol: true }),
		]);
		const snap = await makeCi({}, repo).buildSnapshot();
		expect(snap.outfit.regularSegments).toHaveLength(2);
	});
});

describe("CharacterInventory.setArcanaItems", () => {
	it("injected arcana item appears in outfit.regularItems", async () => {
		const ci = makeCi();
		ci.setArcanaItems([makeOutfitItem({ slug: "arc-1", inventoryColumn: "regular" })]);
		const snap = await ci.buildSnapshot();
		expect(snap.outfit.regularItems.some(i => i.slug === "arc-1")).toBe(true);
	});

	it("calling setArcanaItems with [] clears previous arcana items", async () => {
		const ci = makeCi();
		ci.setArcanaItems([makeOutfitItem({ slug: "arc-1", inventoryColumn: "regular" })]);
		ci.setArcanaItems([]);
		const snap = await ci.buildSnapshot();
		expect(snap.outfit.regularItems.some(i => i.slug === "arc-1")).toBe(false);
	});

	it("arcana items have ownedId null and isCustom false", async () => {
		const ci = makeCi();
		ci.setArcanaItems([makeOutfitItem({ slug: "arc-1", inventoryColumn: "regular" })]);
		const snap = await ci.buildSnapshot();
		const item = snap.outfit.regularItems.find(i => i.slug === "arc-1");
		expect(item.ownedId).toBeNull();
		expect(item.isCustom).toBe(false);
	});

	it("injected arcana item in small column appears in outfit.smallItems", async () => {
		const ci = makeCi();
		ci.setArcanaItems([makeOutfitItem({ slug: "arc-small", inventoryColumn: "small" })]);
		const snap = await ci.buildSnapshot();
		expect(snap.outfit.smallItems.some(i => i.slug === "arc-small")).toBe(true);
	});
});

describe("CharacterInventory custom items from actor.items", () => {
	const actorItem = (id, col = "regular") => ({
		_id: id, type: "equipment", name: "Item " + id,
		system: { equipmentType: "inventory-custom", inventoryColumn: col, weight: 1 },
	});

	it("custom item appears in outfit.regularItems", async () => {
		const snap = await makeCi({}, null, null, makeActor([actorItem("c-1")])).buildSnapshot();
		expect(snap.outfit.regularItems.some(i => i.slug === "c-1")).toBe(true);
	});

	it("custom item has isCustom=true and ownedId set", async () => {
		const snap = await makeCi({}, null, null, makeActor([actorItem("c-1")])).buildSnapshot();
		const item = snap.outfit.regularItems.find(i => i.slug === "c-1");
		expect(item.isCustom).toBe(true);
		expect(item.ownedId).toBe("c-1");
	});

	it("non-custom equipment items are not included", async () => {
		const nonCustom = { _id: "sword", type: "equipment", name: "Sword",
			system: { equipmentType: "weapon", inventoryColumn: "regular", weight: 1 } };
		const snap = await makeCi({}, null, null, makeActor([nonCustom])).buildSnapshot();
		expect(snap.outfit.regularItems.some(i => i.slug === "sword")).toBe(false);
	});
});

describe("CharacterInventory.addCustomItem", () => {
	it("creates a regular-column equipment item with the given name and weight", async () => {
		const actor = makeActor();
		const ci = makeCi({}, null, null, actor);
		await ci.addCustomItem("Rope", 2);
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [{
			name: "Rope",
			type: "equipment",
			system: { equipmentType: "inventory-custom", inventoryColumn: "regular", weight: 2 },
		}]);
	});

	it("clamps weight to minimum 1", async () => {
		const actor = makeActor();
		const ci = makeCi({}, null, null, actor);
		await ci.addCustomItem("Pebble", 0);
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [
			expect.objectContaining({ system: expect.objectContaining({ weight: 1 }) }),
		]);
	});
});

describe("CharacterInventory.addCustomSmallItem", () => {
	it("creates a small-column equipment item with the given name", async () => {
		const actor = makeActor();
		const ci = makeCi({}, null, null, actor);
		await ci.addCustomSmallItem("Coin");
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [{
			name: "Coin",
			type: "equipment",
			system: { equipmentType: "inventory-custom", inventoryColumn: "small" },
		}]);
	});
});

describe("CharacterInventory.removeCustomItem", () => {
	it("deletes the embedded document by id", async () => {
		const actor = makeActor();
		const ci = makeCi({}, null, null, actor);
		await ci.removeCustomItem("item-42");
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ["item-42"]);
	});
});

describe("CharacterInventory possession outfit items", () => {
	it("possession outfit item in regular column appears in outfit.regularItems", async () => {
		const possItem = makeOutfitItem({ slug: "smithy-tongs", name: "Tongs", inventoryColumn: "regular" });
		const playbookData = { specialPossessions: { pickCount: 1, pickNote: "Pick 1", options: [] } };
		const possessions = makePossessionsFake(null, [possItem]);
		const snap = await makeCi({}, makeRepo(), possessions, null, makeFakePlaybook(playbookData)).buildSnapshot();
		expect(snap.outfit.regularItems.some(i => i.slug === "smithy-tongs")).toBe(true);
	});

	it("possession outfit items do not appear when possessions returns []", async () => {
		const snap = await makeCi().buildSnapshot();
		expect(snap.outfit.regularItems).toHaveLength(0);
	});
});
