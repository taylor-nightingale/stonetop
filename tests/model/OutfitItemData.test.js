import { describe, it, expect } from "vitest";
import { OutfitItemData } from "../../src/data/OutfitItemData.js";

describe("OutfitItemData defaults", () => {
	it("defaults slug, inventoryColumn, source to null", () => {
		const d = new OutfitItemData();
		expect(d.slug).toBeNull();
		expect(d.inventoryColumn).toBeNull();
		expect(d.source).toBeNull();
	});

	it("defaults weight to 1 and twoCol to false", () => {
		const d = new OutfitItemData();
		expect(d.weight).toBe(1);
		expect(d.twoCol).toBe(false);
	});

	it("defaults tags and note to empty string", () => {
		const d = new OutfitItemData();
		expect(d.tags).toBe("");
		expect(d.note).toBe("");
	});

	it("defaults resource, armor, sortOrder to null", () => {
		const d = new OutfitItemData();
		expect(d.resource).toBeNull();
		expect(d.armor).toBeNull();
		expect(d.sortOrder).toBeNull();
	});
});
