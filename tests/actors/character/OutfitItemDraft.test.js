import { describe, it, expect, beforeAll } from "vitest";
import { OutfitItemDraft } from "../../../src/actors/character/OutfitItemDraft.js";
import { NewInventoryItem } from "../../../src/actors/character/NewInventoryItem.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";

// The item being added, before it is: what the adder's fields say, and the row it will make.

beforeAll(() => { new FakeGameBuilder().build(); });

describe("OutfitItemDraft", () => {
	it("starts as a nameless item of one ◇ with no uses", () => {
		const d = OutfitItemDraft.for(true);
		expect([d.name, d.weight, d.uses, d.usesWord, d.tags, d.note, d.isRegular]).toEqual(["", 1, 0, "", [], "", true]);
	});

	it("changes one field at a time, leaving itself as it was", () => {
		const d = OutfitItemDraft.for(true);
		const named = d.withName("Rope").withNote("50 ft").withUsesWord("uses");
		expect([named.name, named.note, named.usesWord]).toEqual(["Rope", "50 ft", "uses"]);
		expect(d.name).toBe("");
	});

	it("weighs at least one ◇, and has no fewer than no uses", () => {
		const d = OutfitItemDraft.for(true);
		expect(d.withWeight(0).weight).toBe(1);
		expect(d.withWeight(3).weight).toBe(3);
		expect(d.withUses(-1).uses).toBe(0);
		expect(d.withUses(4).uses).toBe(4);
	});

	it("toggles a tag on and off", () => {
		const d = OutfitItemDraft.for(true).withTagToggled("close").withTagToggled("thrown");
		expect(d.tags).toEqual(["close", "thrown"]);
		expect(d.withTagToggled("close").tags).toEqual(["thrown"]);
	});

	it("offers the book's tags in its picker", () => {
		const picker = OutfitItemDraft.for(true).withTagToggled("close").tagPicker;
		expect(picker.values).toEqual(["close"]);
		expect(picker.multi).toBe(true);
	});

	it("becomes the item to add, trimmed", () => {
		const d = OutfitItemDraft.for(true).withName("  Naphtha ").withWeight(1).withUses(3).withUsesWord("uses")
			.withTagToggled("thrown").withNote(" burns hot ");
		expect(d.toNewItem()).toEqual(NewInventoryItem.regular("Naphtha", 1, { uses: 3, usesWord: "uses", tags: ["thrown"], note: "burns hot" }));
	});

	it("becomes a small item from the small column", () => {
		expect(OutfitItemDraft.for(false).withName("Flint").toNewItem()).toEqual(NewInventoryItem.small("Flint"));
	});

	it("is not an item until it has a name", () => {
		expect(OutfitItemDraft.for(true).withName("   ").toNewItem()).toBeNull();
	});

	// The preview is the real row, so it is built from the same snapshot the inventory draws.
	it("previews as the row it will make: its ◇, tags, note and an empty track", () => {
		const row = OutfitItemDraft.for(true).withName("Naphtha").withWeight(2).withUses(3).withUsesWord("uses")
			.withTagToggled("thrown").withNote("burns hot").preview;
		expect([row.name, row.weight, row.checked, row.isCustom]).toEqual(["Naphtha", 2, false, false]);
		expect(row.tags.map(t => t.value ?? t.token ?? t)).toHaveLength(1);
		expect(row.note.raw).toBe("burns hot");
		expect(row.resource).not.toBeNull();
	});

	it("previews no track without uses", () => {
		expect(OutfitItemDraft.for(true).withName("Rope").preview.resource).toBeNull();
	});
});
