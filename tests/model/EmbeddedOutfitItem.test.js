import { describe, it, expect } from "vitest";
import { EmbeddedOutfitItemBuilder } from "../../module/model/data/character/EmbeddedOutfitItem.js";

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
	it("sets type to 'equipment'", () => {
		expect(makeItem().type).toBe("equipment");
	});

	it("sets system.equipmentType to 'outfit'", () => {
		expect(makeItem().system.equipmentType).toBe("outfit");
	});

	it("sets system.weight", () => {
		expect(makeItem({ weight: 3 }).system.weight).toBe(3);
	});

	it("defaults system.weight to 0 when not set", () => {
		const item = new EmbeddedOutfitItemBuilder().withName("X").build();
		expect(item.system.weight).toBe(0);
	});

	it("stores slug in flags.stonetop.slug", () => {
		expect(makeItem({ slug: "my-slug" }).flags.stonetop.slug).toBe("my-slug");
	});

	it("stores inventoryColumn in flags.stonetop.inventoryColumn", () => {
		expect(makeItem({ inventoryColumn: "small" }).flags.stonetop.inventoryColumn).toBe("small");
	});

	it("defaults inventoryColumn to 'regular'", () => {
		const item = new EmbeddedOutfitItemBuilder().withName("X").build();
		expect(item.flags.stonetop.inventoryColumn).toBe("regular");
	});

	it("stores note in flags.stonetop.note", () => {
		expect(makeItem({ note: "magical" }).flags.stonetop.note).toBe("magical");
	});

	it("defaults note to null", () => {
		expect(makeItem().flags.stonetop.note).toBeNull();
	});

	it("stores resource in flags.stonetop.resource", () => {
		const res = { max: 3, title: "Charges", labels: [] };
		expect(makeItem({ resource: res }).flags.stonetop.resource).toEqual(res);
	});

	it("defaults resource to null", () => {
		expect(makeItem().flags.stonetop.resource).toBeNull();
	});

	it("stores twoCol in flags.stonetop.twoCol", () => {
		expect(makeItem({ twoCol: true }).flags.stonetop.twoCol).toBe(true);
	});

	it("defaults twoCol to false", () => {
		expect(makeItem().flags.stonetop.twoCol).toBe(false);
	});

	it("stores breakBefore in flags.stonetop.breakBefore", () => {
		expect(makeItem({ breakBefore: true }).flags.stonetop.breakBefore).toBe(true);
	});

	it("defaults breakBefore to false", () => {
		expect(makeItem().flags.stonetop.breakBefore).toBe(false);
	});

	it("stores source in flags.stonetop.source", () => {
		expect(makeItem({ source: "arcana:my-arcanum" }).flags.stonetop.source).toBe("arcana:my-arcanum");
	});

	it("defaults source to null", () => {
		const item = new EmbeddedOutfitItemBuilder().withName("X").build();
		expect(item.flags.stonetop.source).toBeNull();
	});

	it("stores name at top level", () => {
		expect(makeItem().name).toBe("Test Item");
	});
});
