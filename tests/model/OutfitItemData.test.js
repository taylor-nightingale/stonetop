import { describe, it, expect } from "vitest";
import { OutfitItemData } from "../../src/data/OutfitItemData.js";

describe("OutfitItemData defaults", () => {
	it("defaults slug, inventoryColumn, source to null", () => {
		const d = new OutfitItemData();
		expect(d.slug).toBeNull();
		expect(d.inventoryColumn).toBeNull();
		expect(d.source).toBeNull();
	});

	it("defaults weight to 1 and the qualifier to empty", () => {
		const d = new OutfitItemData();
		expect(d.weight).toBe(1);
		expect(d.qualifier).toBe("");
	});

	it("defaults note to empty string", () => {
		expect(new OutfitItemData().note).toBe("");
	});

	// Gear tags are the same stored shape as creature tags — one tag model, one schema.
	it("defaults tagList to an empty list", () => {
		expect(new OutfitItemData().tagList).toEqual([]);
	});
});

describe("OutfitItemData.migrateData", () => {
	it("converts a legacy comma string", () => {
		const source = { slug: "spear", tagList: "close, thrown" };
		OutfitItemData.migrateData(source);
		expect(source.tagList).toEqual(["close", "thrown"]);
	});

	it("converts a legacy Selection blob", () => {
		const source = { slug: "spear", tagList: { selected: ["close"], options: [], multi: true, allowCustom: true } };
		OutfitItemData.migrateData(source);
		expect(source.tagList).toEqual(["close"]);
	});

	it("folds a legacy nested `tags` key onto tagList", () => {
		const source = { slug: "lantern", tags: "close, area" };
		OutfitItemData.migrateData(source);
		expect(source.tagList).toEqual(["close", "area"]);
		expect("tags" in source).toBe(false);
	});

	// migrateData also runs on the partial update diff — injecting a default there would clobber the
	// stored tags on every unrelated edit.
	it("leaves an update diff that carries no tags alone", () => {
		const diff = { weight: 2 };
		OutfitItemData.migrateData(diff);
		expect(diff).toEqual({ weight: 2 });
	});

	it("is idempotent", () => {
		const source = { tagList: ["close"] };
		OutfitItemData.migrateData(source);
		expect(source.tagList).toEqual(["close"]);
	});

	it("defaults resource and armor to null", () => {
		const d = new OutfitItemData();
		expect(d.resource).toBeNull();
		expect(d.armor).toBeNull();
	});

	it("has no sort field — outfit rows render in compendium order", () => {
		expect(Object.keys(OutfitItemData.defineSchema())).not.toContain("sortOrder");
	});
});
