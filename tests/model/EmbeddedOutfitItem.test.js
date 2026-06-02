import { describe, it, expect } from "vitest";
import { EmbeddedOutfitItemBuilder } from "../../src/model/data/character/EmbeddedOutfitItem.js";

function makeItem(overrides = {}) {
	let b = new EmbeddedOutfitItemBuilder()
		.withSlug("test-slug")
		.withName("Test Item")
		.withWeight(2)
		.withInventoryColumn("regular")
		.withSource("arcana:test-slug");
	for (const [k, v] of Object.entries(overrides)) b = b[`with${k[0].toUpperCase() + k.slice(1)}`](v);
	return b.build();
}

describe("EmbeddedOutfitItemBuilder", () => {
	it("sets type to 'outfitItem'", () => {
		expect(makeItem().type).toBe("outfitItem");
	});

	it("has no flags", () => {
		expect(makeItem().flags).toBeUndefined();
	});

	it("stores weight in system.weight", () => {
		expect(makeItem({ weight: 3 }).system.weight).toBe(3);
	});

	it("defaults system.weight to 0 when not set", () => {
		const item = new EmbeddedOutfitItemBuilder().withName("X").build();
		expect(item.system.weight).toBe(0);
	});

	it("stores slug in system.slug", () => {
		expect(makeItem({ slug: "my-slug" }).system.slug).toBe("my-slug");
	});

	it("stores inventoryColumn in system.inventoryColumn", () => {
		expect(makeItem({ inventoryColumn: "small" }).system.inventoryColumn).toBe("small");
	});

	it("defaults inventoryColumn to 'regular'", () => {
		const item = new EmbeddedOutfitItemBuilder().withName("X").build();
		expect(item.system.inventoryColumn).toBe("regular");
	});

	it("stores tags in system.tags", () => {
		expect(makeItem({ tags: "hand, thrown" }).system.tags).toBe("hand, thrown");
	});

	it("defaults tags to empty string", () => {
		expect(makeItem().system.tags).toBe("");
	});

	it("stores note in system.note", () => {
		expect(makeItem({ note: "x piercing" }).system.note).toBe("x piercing");
	});

	it("defaults note to null", () => {
		expect(makeItem().system.note).toBeNull();
	});

	it("stores resource in system.resource", () => {
		const res = { max: 3, title: "Charges", labels: [] };
		expect(makeItem({ resource: res }).system.resource).toEqual(res);
	});

	it("defaults resource to null", () => {
		expect(makeItem().system.resource).toBeNull();
	});

	it("stores twoCol in system.twoCol", () => {
		expect(makeItem({ twoCol: true }).system.twoCol).toBe(true);
	});

	it("defaults twoCol to false", () => {
		expect(makeItem().system.twoCol).toBe(false);
	});

	it("stores source in system.source", () => {
		expect(makeItem({ source: "arcana:my-arcanum" }).system.source).toBe("arcana:my-arcanum");
	});

	it("defaults source to null", () => {
		const item = new EmbeddedOutfitItemBuilder().withName("X").build();
		expect(item.system.source).toBeNull();
	});

	it("stores name at top level", () => {
		expect(makeItem().name).toBe("Test Item");
	});
});
