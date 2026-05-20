import {describe, expect, it, vi} from "vitest";
import {CharacterInventory} from "../../../module/actors/character/CharacterInventory.js";
import {OutfitItemBuilder} from "../../../module/model/OutfitItem.js";
import {TestCharacterBuilder} from "../../fakes/TestCharacterBuilder.js";
import {FakeInventoryRepository} from "../../fakes/FakeInventoryRepository.js";
import {FakeActorBuilder} from "../../fakes/FakeActorBuilder.js";

// -- Fake flags ---------------------------------------------------------------

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
		.withResource(labels != null ? {max: labels.length, title: null, labels} : (overrides.resource ?? null))
		.withTwoCol(overrides.twoCol ?? false)
		.withSmallGrid(overrides.smallGrid ?? false)
		.withBreakBefore(overrides.breakBefore ?? false)
		.build();
}

// -- CharacterInventory -------------------------------------------------------

describe("CharacterInventory", () => {
	it("checked returns {} when no flags set", () => {
		const ci = new CharacterInventory(makeFlags());
		expect(ci.checked).toEqual({});
	});

	it("resources returns {} when no flags set", () => {
		const ci = new CharacterInventory(makeFlags());
		expect(ci.resources).toEqual({});
	});

	it("setItemChecked stores true for a slug", async () => {
		const store = {};
		const ci = new CharacterInventory(makeFlags(store));
		await ci.setItemChecked("supplies", true);
		expect(store.checked).toEqual({supplies: true});
	});

	it("setItemChecked stores false to uncheck", async () => {
		const store = {checked: {supplies: true}};
		const ci = new CharacterInventory(makeFlags(store));
		await ci.setItemChecked("supplies", false);
		expect(store.checked).toEqual({supplies: false});
	});

	it("setResource stores integer count for a slug", async () => {
		const store = {};
		const ci = new CharacterInventory(makeFlags(store));
		await ci.setResource("bow-arrows", 2);
		expect(store.resources).toEqual({"bow-arrows": 2});
	});
});

// -- StonetopCharacter.buildInventoryContext ----------------------------------

describe("StonetopCharacter.buildInventoryContext", () => {
	it("all items default to checked: false", async () => {
		const char = new TestCharacterBuilder(new FakeActorBuilder().build())
			.withPlaybookRepo(null)
			.withMoveRepo(null)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem()]))
			.build();
		const ctx = await char.buildInventoryContext();
		expect(ctx.regularItems[0].checked).toBe(false);
	});

	it("checked items show checked: true", async () => {
		const actor = new FakeActorBuilder().withFlag("inventory.checked", {"test-item": true}).build();
		const char = new TestCharacterBuilder(actor)
			.withPlaybookRepo(null)
			.withMoveRepo(null)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem()]))
			.build();
		const ctx = await char.buildInventoryContext();
		expect(ctx.regularItems[0].checked).toBe(true);
	});

	it("resourceChecks is null for items with no resource", async () => {
		const char = new TestCharacterBuilder(new FakeActorBuilder().build())
			.withPlaybookRepo(null)
			.withMoveRepo(null)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem({resource: null})]))
			.build();
		const ctx = await char.buildInventoryContext();
		expect(ctx.regularItems[0].resourceChecks).toBeNull();
	});

	it("resourceChecks array length matches resource.max", async () => {
		const char = new TestCharacterBuilder(new FakeActorBuilder().build())
			.withPlaybookRepo(null)
			.withMoveRepo(null)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem({resourceLabels: ["low ammo", "all out"]})]))
			.build();
		const ctx = await char.buildInventoryContext();
		expect(ctx.regularItems[0].resourceChecks).toHaveLength(2);
	});

	it("resourceChecks[i].checked is true when i < resources[slug]", async () => {
		const actor = new FakeActorBuilder().withFlag("inventory.resources", {"test-item": 1}).build();
		const char = new TestCharacterBuilder(actor)
			.withPlaybookRepo(null)
			.withMoveRepo(null)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem({resourceLabels: ["low ammo", "all out"]})]))
			.build();
		const ctx = await char.buildInventoryContext();
		expect(ctx.regularItems[0].resourceChecks[0].checked).toBe(true);
		expect(ctx.regularItems[0].resourceChecks[1].checked).toBe(false);
	});

	it("resourceChecks[i].label is null for empty string entries", async () => {
		const char = new TestCharacterBuilder(new FakeActorBuilder().build())
			.withPlaybookRepo(null)
			.withMoveRepo(null)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem({resourceLabels: ["", ""]})]))
			.build();
		const ctx = await char.buildInventoryContext();
		expect(ctx.regularItems[0].resourceChecks[0].label).toBeNull();
	});

	it("weightSlots array length matches item weight", async () => {
		const char = new TestCharacterBuilder(new FakeActorBuilder().build())
			.withPlaybookRepo(null)
			.withMoveRepo(null)
			.withInventoryRepo(new FakeInventoryRepository([makeOutfitItem({weight: 2})]))
			.build();
		const ctx = await char.buildInventoryContext();
		expect(ctx.regularItems[0].weightSlots).toHaveLength(2);
	});

	it("regularItems only contains inventoryColumn=regular items", async () => {
		const char = new TestCharacterBuilder(new FakeActorBuilder().build())
			.withPlaybookRepo(null)
			.withMoveRepo(null)
			.withInventoryRepo(new FakeInventoryRepository([
				makeOutfitItem({slug: "a", inventoryColumn: "regular"}),
				makeOutfitItem({slug: "b", inventoryColumn: "small", smallGrid: false}),
			]))
			.build();
		const ctx = await char.buildInventoryContext();
		expect(ctx.regularItems).toHaveLength(1);
		expect(ctx.regularItems[0].slug).toBe("a");
	});

	it("smallItems only contains non-grid small items", async () => {
		const char = new TestCharacterBuilder(new FakeActorBuilder().build())
			.withPlaybookRepo(null)
			.withMoveRepo(null)
			.withInventoryRepo(new FakeInventoryRepository([
				makeOutfitItem({slug: "a", inventoryColumn: "small", smallGrid: false, sortOrder: 1}),
				makeOutfitItem({slug: "b", inventoryColumn: "small", smallGrid: true, sortOrder: 2}),
			]))
			.build();
		const ctx = await char.buildInventoryContext();
		expect(ctx.smallItems).toHaveLength(1);
		expect(ctx.smallItems[0].slug).toBe("a");
		expect(ctx.smallGridItems).toHaveLength(1);
		expect(ctx.smallGridItems[0].slug).toBe("b");
	});
});
