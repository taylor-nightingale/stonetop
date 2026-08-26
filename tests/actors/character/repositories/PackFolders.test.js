import { describe, it, expect } from "vitest";
import { PackFolders } from "../../../../src/actors/character/repositories/PackFolders.js";

// A pack's folder tree answers what its documents ARE to the system, not only how they're shelved:
// outfit-items keeps the printed Inventory insert under "Default" and the rest of Book I's priced
// goods under "Special items", and only the first is what a character sheet draws.

const tree = () => new PackFolders([
	{ _id: "default", name: "Default", folder: null },
	{ _id: "warmth", name: "Warmth", folder: "default" },
	{ _id: "special", name: "Special items", folder: null },
	{ _id: "weapons-of-war", name: "Weapons of War", folder: "special" },
]);

describe("PackFolders", () => {
	it("answers a folder's own name", () => {
		expect(tree().nameOf("warmth")).toBe("Warmth");
	});

	it("has no name for a folder it doesn't know, or for none at all", () => {
		expect(tree().nameOf("nope")).toBeNull();
		expect(tree().nameOf(null)).toBeNull();
	});

	it("counts a folder as under itself", () => {
		expect(tree().isUnder("default", "default")).toBe(true);
	});

	it("counts a child as under its parent", () => {
		expect(tree().isUnder("warmth", "default")).toBe(true);
	});

	it("does not count a sibling tree's folder", () => {
		expect(tree().isUnder("weapons-of-war", "default")).toBe(false);
		expect(tree().isUnder("special", "default")).toBe(false);
	});

	it("says no for an item filed nowhere", () => {
		expect(tree().isUnder(null, "default")).toBe(false);
	});

	// Foundry hands a parent back as a document when the pack is loaded and as a bare id when it is
	// only indexed; the sheet must not care which it got.
	it("reads a parent given as a document as readily as an id", () => {
		const folders = new PackFolders([
			{ _id: "default", name: "Default", folder: null },
			{ _id: "warmth", name: "Warmth", folder: { _id: "default" } },
		]);
		expect(folders.isUnder("warmth", "default")).toBe(true);
	});

	// Nothing should be able to hang the sheet, however a pack was built.
	it("terminates on a folder tree that cycles", () => {
		const folders = new PackFolders([
			{ _id: "a", name: "A", folder: "b" },
			{ _id: "b", name: "B", folder: "a" },
		]);
		expect(folders.isUnder("a", "default")).toBe(false);
	});
});
