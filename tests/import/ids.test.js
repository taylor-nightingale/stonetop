import { describe, it, expect } from "vitest";
import { deterministicId, documentKey } from "../../scripts/import/ids.js";

describe("deterministicId", () => {
	it("produces a 16-char Foundry-alphabet id", () => {
		const id = deterministicId("stonetop-bestiary", "boar");
		expect(id).toMatch(/^[A-Za-z0-9]{16}$/);
	});

	it("is stable across calls (re-imports keep the same id)", () => {
		expect(deterministicId("stonetop-lore", "danu")).toBe(deterministicId("stonetop-lore", "danu"));
	});

	it("namespaces the slug so the same slug differs across packs", () => {
		const actor = deterministicId("stonetop-bestiary", "boar");
		const journal = deterministicId("stonetop-bestiary-journal", "boar");
		expect(actor).not.toBe(journal);
	});
});

describe("documentKey", () => {
	it("uses the right collection prefix per document type", () => {
		expect(documentKey("Actor", "abc")).toBe("!actors!abc");
		expect(documentKey("Item", "abc")).toBe("!items!abc");
		expect(documentKey("JournalEntry", "abc")).toBe("!journal!abc");
	});

	it("throws on an unknown document type", () => {
		expect(() => documentKey("Macro", "abc")).toThrow();
	});
});
