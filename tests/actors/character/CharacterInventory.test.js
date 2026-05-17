import { describe, it, expect, vi } from "vitest";
import { CharacterInventory } from "../../../module/actors/character/CharacterInventory.js";
import { StonetopCharacter } from "../../../module/actors/character/StonetopCharacter.js";

// -- Fake flags ---------------------------------------------------------------

function makeFlags(store = {}) {
	return {
		getFlag: (key) => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

// -- Fake repositories (minimal) ----------------------------------------------

class FakePlaybookRepository {
	async findBySlug() { return null; }
}

class FakePlaybookMoveRepository {
	async getMovesForPlaybook() { return []; }
	async getDocument() { return null; }
}

class FakeBasicMoveRepository {
	async getAll() { return []; }
}

class FakeInventoryRepository {
	constructor(items = []) { this._items = items; }
	async getAll() { return this._items; }
}

// -- Fake actor ---------------------------------------------------------------

function makeActor({ flags = {}, items = [] } = {}) {
	const flagStore = { stonetop: { ...flags } };
	return {
		type: "character",
		system: { playbook: { slug: null, name: null }, attributes: { level: { value: 1 } } },
		items,
		flags: flagStore,
		getFlag: (scope, key) => flagStore[scope]?.[key] ?? null,
		setFlag: vi.fn(async (scope, key, val) => { flagStore[scope] ??= {}; flagStore[scope][key] = val; }),
		update: vi.fn(),
		createEmbeddedDocuments: vi.fn(),
		deleteEmbeddedDocuments: vi.fn(),
	};
}

function makeCharacter(actor, inventoryItems = []) {
	return new StonetopCharacter(
		actor,
		new FakePlaybookRepository(),
		new FakePlaybookMoveRepository(),
		new FakeBasicMoveRepository(),
		new FakeInventoryRepository(inventoryItems),
	);
}

function makeCompendiumItem(overrides = {}) {
	return {
		_id: overrides._id ?? "abc123",
		name: overrides.name ?? "Test Item",
		system: {
			slug: overrides.slug ?? "test-item",
			inventoryColumn: overrides.inventoryColumn ?? "regular",
			sortOrder: overrides.sortOrder ?? 1,
			weight: overrides.weight ?? 1,
			note: overrides.note ?? null,
			resourceLabels: overrides.resourceLabels ?? null,
			breakBefore: overrides.breakBefore ?? false,
			smallGrid: overrides.smallGrid ?? false,
		},
	};
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
		expect(store.checked).toEqual({ supplies: true });
	});

	it("setItemChecked stores false to uncheck", async () => {
		const store = { checked: { supplies: true } };
		const ci = new CharacterInventory(makeFlags(store));
		await ci.setItemChecked("supplies", false);
		expect(store.checked).toEqual({ supplies: false });
	});

	it("setResource stores integer count for a slug", async () => {
		const store = {};
		const ci = new CharacterInventory(makeFlags(store));
		await ci.setResource("bow-arrows", 2);
		expect(store.resources).toEqual({ "bow-arrows": 2 });
	});
});

// -- StonetopCharacter.buildInventoryContext ----------------------------------

describe("StonetopCharacter.buildInventoryContext", () => {
	it("all items default to checked: false", async () => {
		const actor = makeActor();
		const char = makeCharacter(actor, [makeCompendiumItem()]);
		const ctx = await char.buildInventoryContext();
		expect(ctx.regularItems[0].checked).toBe(false);
	});

	it("checked items show checked: true", async () => {
		const actor = makeActor({ flags: { "inventory.checked": { "test-item": true } } });
		const char = makeCharacter(actor, [makeCompendiumItem()]);
		const ctx = await char.buildInventoryContext();
		expect(ctx.regularItems[0].checked).toBe(true);
	});

	it("resourceChecks is null for items with no resourceLabels", async () => {
		const actor = makeActor();
		const char = makeCharacter(actor, [makeCompendiumItem({ resourceLabels: null })]);
		const ctx = await char.buildInventoryContext();
		expect(ctx.regularItems[0].resourceChecks).toBeNull();
	});

	it("resourceChecks array length matches resourceLabels length", async () => {
		const actor = makeActor();
		const char = makeCharacter(actor, [makeCompendiumItem({ resourceLabels: ["low ammo", "all out"] })]);
		const ctx = await char.buildInventoryContext();
		expect(ctx.regularItems[0].resourceChecks).toHaveLength(2);
	});

	it("resourceChecks[i].checked is true when i < resources[slug]", async () => {
		const actor = makeActor({ flags: { "inventory.resources": { "test-item": 1 } } });
		const char = makeCharacter(actor, [makeCompendiumItem({ resourceLabels: ["low ammo", "all out"] })]);
		const ctx = await char.buildInventoryContext();
		expect(ctx.regularItems[0].resourceChecks[0].checked).toBe(true);
		expect(ctx.regularItems[0].resourceChecks[1].checked).toBe(false);
	});

	it("resourceChecks[i].label is null for empty string entries", async () => {
		const actor = makeActor();
		const char = makeCharacter(actor, [makeCompendiumItem({ resourceLabels: ["", ""] })]);
		const ctx = await char.buildInventoryContext();
		expect(ctx.regularItems[0].resourceChecks[0].label).toBeNull();
	});

	it("weightSlots array length matches item weight", async () => {
		const actor = makeActor();
		const char = makeCharacter(actor, [makeCompendiumItem({ weight: 2 })]);
		const ctx = await char.buildInventoryContext();
		expect(ctx.regularItems[0].weightSlots).toHaveLength(2);
	});

	it("regularItems only contains inventoryColumn=regular items", async () => {
		const actor = makeActor();
		const char = makeCharacter(actor, [
			makeCompendiumItem({ slug: "a", inventoryColumn: "regular" }),
			makeCompendiumItem({ slug: "b", inventoryColumn: "small", smallGrid: false }),
		]);
		const ctx = await char.buildInventoryContext();
		expect(ctx.regularItems).toHaveLength(1);
		expect(ctx.regularItems[0].slug).toBe("a");
	});

	it("smallItems only contains non-grid small items", async () => {
		const actor = makeActor();
		const char = makeCharacter(actor, [
			makeCompendiumItem({ slug: "a", inventoryColumn: "small", smallGrid: false, sortOrder: 1 }),
			makeCompendiumItem({ slug: "b", inventoryColumn: "small", smallGrid: true,  sortOrder: 2 }),
		]);
		const ctx = await char.buildInventoryContext();
		expect(ctx.smallItems).toHaveLength(1);
		expect(ctx.smallItems[0].slug).toBe("a");
		expect(ctx.smallGridItems).toHaveLength(1);
		expect(ctx.smallGridItems[0].slug).toBe("b");
	});
});
