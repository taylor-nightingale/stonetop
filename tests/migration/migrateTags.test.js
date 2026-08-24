import { describe, it, expect } from "vitest";
import { toStoredTags, toStoredTagOptions, migrateTagsOn, migrateEmbeddedOutfitTags } from "../../src/migration/migrateTags.js";

// The stored shape is the token list itself; a "blob" is the legacy Selection it replaces.
const blob = (selected, options = []) => ({ selected, options, multi: true, allowCustom: true });

describe("toStoredTags", () => {
	it("converts a legacy comma string", () => {
		expect(toStoredTags("close, thrown")).toEqual(["close", "thrown"]);
	});

	it("converts a legacy Selection blob to its tokens", () => {
		expect(toStoredTags(blob(["close", "thrown"], ["group"]))).toEqual(["close", "thrown"]);
	});

	it("converts an empty string to no tags", () => {
		expect(toStoredTags("")).toEqual([]);
	});

	it("drops blank entries from an array", () => {
		expect(toStoredTags(["big", "", "  ", "old"])).toEqual(["big", "old"]);
	});

	// Foundry re-runs migrateData on the partial update diff; returning a value for an absent field
	// would write it back on every edit.
	it("leaves an absent value alone", () => {
		expect(toStoredTags(undefined)).toBeUndefined();
		expect(toStoredTags(null)).toBeUndefined();
	});

	it("is idempotent — a clean token array needs no second pass", () => {
		expect(toStoredTags(["close", "thrown"])).toBeUndefined();
		expect(toStoredTags([])).toBeUndefined();
	});
});

describe("toStoredTagOptions", () => {
	// A stat block's printed choices are authored data, but they are not part of the value — they
	// move to the sibling field rather than riding inside the tag list.
	it("lifts the options a legacy blob carried", () => {
		expect(toStoredTagOptions(blob([], ["group", "exceptional"]))).toEqual(["group", "exceptional"]);
	});

	it("has nothing to lift from a blob with no options", () => {
		expect(toStoredTagOptions(blob(["close"]))).toBeUndefined();
	});

	it("has nothing to lift from a string, an array, or nothing at all", () => {
		expect(toStoredTagOptions("close, thrown")).toBeUndefined();
		expect(toStoredTagOptions(["close"])).toBeUndefined();
		expect(toStoredTagOptions(null)).toBeUndefined();
	});
});

describe("migrateTagsOn", () => {
	it("converts tagList in place and reports the change", () => {
		const holder = { name: "Spear", tagList: "close, thrown" };
		expect(migrateTagsOn(holder)).toBe(true);
		expect(holder.tagList).toEqual(["close", "thrown"]);
	});

	it("folds a legacy `tags` key onto tagList", () => {
		const holder = { name: "Rune-laden Scales", tags: "magical" };
		migrateTagsOn(holder);
		expect(holder.tagList).toEqual(["magical"]);
		expect("tags" in holder).toBe(false);
	});

	it("converts a legacy Selection blob and lifts its options to tagOptions", () => {
		const holder = { tagList: blob(["group"], ["group", "exceptional"]) };
		migrateTagsOn(holder);
		expect(holder.tagList).toEqual(["group"]);
		expect(holder.tagOptions).toEqual(["group", "exceptional"]);
	});

	it("leaves tagOptions alone when the document already has some", () => {
		const holder = { tagList: blob(["group"], ["group"]), tagOptions: ["already", "set"] };
		migrateTagsOn(holder);
		expect(holder.tagOptions).toEqual(["already", "set"]);
	});

	it("adds no tagOptions for a blob that carried none", () => {
		const holder = { tagList: blob(["close"]) };
		migrateTagsOn(holder);
		expect("tagOptions" in holder).toBe(false);
	});

	it("keeps tagList when a holder carries both keys", () => {
		const holder = { tagList: "close", tags: "magical" };
		migrateTagsOn(holder);
		expect(holder.tagList).toEqual(["close"]);
		expect("tags" in holder).toBe(false);
	});

	it("touches nothing on a holder with no tags at all", () => {
		const holder = { name: "Rope", weight: 1 };
		expect(migrateTagsOn(holder)).toBe(false);
		expect(holder).toEqual({ name: "Rope", weight: 1 });
	});

	it("reports no change for an already converted holder", () => {
		const holder = { tagList: ["close"] };
		expect(migrateTagsOn(holder)).toBe(false);
		expect(holder.tagList).toEqual(["close"]);
	});

	it("survives a non-object", () => {
		expect(migrateTagsOn(null)).toBe(false);
		expect(migrateTagsOn(undefined)).toBe(false);
	});
});

describe("migrateEmbeddedOutfitTags", () => {
	it("converts a possession's own outfit items", () => {
		const source = { outfitItems: [{ slug: "lantern", tags: "close, area" }, { slug: "prybars" }] };
		expect(migrateEmbeddedOutfitTags(source)).toBe(true);
		expect(source.outfitItems[0].tagList).toEqual(["close", "area"]);
		expect("tags" in source.outfitItems[0]).toBe(false);
		expect(source.outfitItems[1].tagList).toBeUndefined();
	});

	// The same array hides inside choice options; hard-coding one path would miss it.
	it("converts outfit items nested inside a choice group's options", () => {
		const source = { choices: { list: [{ options: [{ outfitItems: [{ tagList: "close, far" }] }] }] } };
		migrateEmbeddedOutfitTags(source);
		expect(source.choices.list[0].options[0].outfitItems[0].tagList).toEqual(["close", "far"]);
	});

	it("reports no change when nothing embedded carries tags", () => {
		expect(migrateEmbeddedOutfitTags({ outfitItems: [{ slug: "rope" }] })).toBe(false);
		expect(migrateEmbeddedOutfitTags({})).toBe(false);
	});

	it("survives null and non-objects in the tree", () => {
		expect(migrateEmbeddedOutfitTags({ front: null, back: 3, choices: [null] })).toBe(false);
	});
});
