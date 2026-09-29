import { describe, it, expect } from "vitest";
import { NewInventoryItem } from "../../../src/actors/character/NewInventoryItem.js";

// What the outfit adder hands the character: a name, the ◇ it weighs (a small item has none), a
// track of uses, its tags and a note — stored in the shape the pack's own gear uses.

describe("NewInventoryItem", () => {
	it("is a regular item of the weight given, or a small item with none", () => {
		const rope = NewInventoryItem.regular("Rope", 2);
		const flint = NewInventoryItem.small("Flint");
		expect([rope.isRegular, rope.weight]).toEqual([true, 2]);
		expect([flint.isRegular, flint.weight]).toEqual([false, 0]);
	});

	it("carries its tags and note", () => {
		const spear = NewInventoryItem.regular("Spear", 1, { tags: ["close", "thrown"], note: "iron" });
		expect([spear.tags, spear.note]).toEqual([["close", "thrown"], "iron"]);
	});

	// Naphtha, in the pack: `{ max: 3, title: null, labels: ["", "", "uses"] }` — the word under the
	// last box.
	it("stores its uses as the pack stores a track, the word under the last box", () => {
		expect(NewInventoryItem.regular("Naphtha", 1, { uses: 3, usesWord: "uses" }).resource)
			.toEqual({ max: 3, title: null, labels: ["", "", "uses"] });
	});

	it("stores a track with no word as bare boxes", () => {
		expect(NewInventoryItem.regular("Torches", 1, { uses: 2 }).resource).toEqual({ max: 2, title: null, labels: [] });
	});

	it("has no track without uses", () => {
		expect(NewInventoryItem.regular("Rope", 1).resource).toBeNull();
		expect(NewInventoryItem.regular("Rope", 1, { uses: 0, usesWord: "uses" }).resource).toBeNull();
	});
});
