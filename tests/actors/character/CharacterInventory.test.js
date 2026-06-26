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
		const ci = new CharacterInventory(makeFlags());
		expect(ci.calculateArmor([makeArmorItem("thick-hides", { base: 1 })])).toBe(0);
	});

	it("returns the base value of a single equipped base-armor item", () => {
		const ci = new CharacterInventory(makeFlags({ checked: { "thick-hides": true } }));
		expect(ci.calculateArmor([makeArmorItem("thick-hides", { base: 1 })])).toBe(1);
	});

	it("uses the highest base when multiple base-armor items are equipped", () => {
		const ci = new CharacterInventory(makeFlags({ checked: { "light-armor": true, "heavy-armor": true } }));
		const items = [
			makeArmorItem("light-armor", { base: 1 }),
			makeArmorItem("heavy-armor", { base: 3 }),
		];
		expect(ci.calculateArmor(items)).toBe(3);
	});

	it("adds modifier to base when a modifier item is also equipped", () => {
		const ci = new CharacterInventory(makeFlags({ checked: { "thick-hides": true, "shield": true } }));
		const items = [
			makeArmorItem("thick-hides", { base: 1 }),
			makeArmorItem("shield",      { modifier: 1 }),
		];
		expect(ci.calculateArmor(items)).toBe(2);
	});

	it("returns modifier alone when no base item is equipped", () => {
		const ci = new CharacterInventory(makeFlags({ checked: { "shield": true } }));
		expect(ci.calculateArmor([makeArmorItem("shield", { modifier: 1 })])).toBe(1);
	});

	it("ignores unchecked items", () => {
		const ci = new CharacterInventory(makeFlags({ checked: { "thick-hides": false } }));
		expect(ci.calculateArmor([makeArmorItem("thick-hides", { base: 1 })])).toBe(0);
	});

	it("ignores items with no armor", () => {
		const ci = new CharacterInventory(makeFlags({ checked: { "cloak": true } }));
		expect(ci.calculateArmor([makeArmorItem("cloak", null)])).toBe(0);
	});
});

// -- StonetopCharacter.toggleCarriedItem (Have What You Need) ------------------

describe("StonetopCharacter.toggleCarriedItem", () => {
	function makeChar(actor) {
		return new TestCharacterBuilder(actor)
			.withPlaybookRepo(null)
			.withMoveRepo(null)
			.withInventoryRepo(new FakeInventoryRepository([]))
			.build();
	}

	it("marks an item by moving its weight out of the undefined ◇ pool", async () => {
		const actor = new FakeActorBuilder().withFlag("inventory.regularPool", 3).build();
		await makeChar(actor).toggleCarriedItem("rope", true, { weight: 2 });
		expect(actor.getFlag("stonetop", "inventory.checked")).toEqual({ rope: true });
		expect(actor.getFlag("stonetop", "inventory.regularPool")).toBe(1);
	});

	it("marks an item the pool can't fully cover, draining the reserve (the rest becomes load)", async () => {
		const actor = new FakeActorBuilder().withFlag("inventory.regularPool", 1).build();
		await makeChar(actor).toggleCarriedItem("armor", true, { weight: 3 });
		// Item is carried; the 1 available ◇ is spent and the other 2 add to the load.
		expect(actor.getFlag("stonetop", "inventory.checked")).toEqual({ armor: true });
		expect(actor.getFlag("stonetop", "inventory.regularPool")).toBe(0);
	});

	it("marking then un-marking an item returns exactly what was drawn (a no-op on the pool)", async () => {
		const actor = new FakeActorBuilder().withFlag("inventory.regularPool", 3).build();
		const char = makeChar(actor);
		await char.toggleCarriedItem("rope", true, { weight: 2 });   // draw 2, pool 3 → 1
		await char.toggleCarriedItem("rope", false, { weight: 2 });  // refund 2, pool 1 → 3
		expect(actor.getFlag("stonetop", "inventory.regularPool")).toBe(3);
		expect(actor.getFlag("stonetop", "inventory.checked")).toEqual({ rope: false });
	});

	it("un-marking an item the pool couldn't cover refunds only what was drawn, never inventing marks", async () => {
		const actor = new FakeActorBuilder().withFlag("inventory.regularPool", 1).build();
		const char = makeChar(actor);
		await char.toggleCarriedItem("armor", true, { weight: 3 });  // draw 1 (2 became loot), pool 1 → 0
		await char.toggleCarriedItem("armor", false, { weight: 3 }); // refund only the 1 drawn
		expect(actor.getFlag("stonetop", "inventory.regularPool")).toBe(1);
	});

	it("un-marking an item defined at Outfit (no draw recorded) drops its weight without inflating the pool", async () => {
		const actor = new FakeActorBuilder()
			.withFlag("inventory.regularPool", 1)
			.withFlag("inventory.checked", { rope: true })
			.build();
		await makeChar(actor).toggleCarriedItem("rope", false, { weight: 2 });
		expect(actor.getFlag("stonetop", "inventory.regularPool")).toBe(1);
	});

	it("small items move a single □ to and from the small pool", async () => {
		const actor = new FakeActorBuilder().withFlag("inventory.smallPool", 2).build();
		const char = makeChar(actor);
		await char.toggleCarriedItem("flint", true, { small: true });
		expect(actor.getFlag("stonetop", "inventory.smallPool")).toBe(1);
		await char.toggleCarriedItem("flint", false, { small: true });
		expect(actor.getFlag("stonetop", "inventory.smallPool")).toBe(2);
	});
});
