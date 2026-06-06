import { describe, it, expect } from "vitest";
import { PlaybookData } from "../../src/data/PlaybookData.js";

describe("PlaybookData defaults", () => {
	it("defaults slug and actorType to null", () => {
		const d = new PlaybookData();
		expect(d.slug).toBeNull();
		expect(d.actorType).toBeNull();
	});

	it("defaults description, statsNote, startingMovesNote to empty string", () => {
		const d = new PlaybookData();
		expect(d.description).toBe("");
		expect(d.statsNote).toBe("");
		expect(d.startingMovesNote).toBe("");
	});

	it("defaults hp to 0 and damage.value to null", () => {
		const d = new PlaybookData();
		expect(d.hp).toBe(0);
		expect(d.damage.value).toBeNull();
	});

	it("defaults arrays to empty", () => {
		const d = new PlaybookData();
		expect(d.backgrounds).toEqual([]);
		expect(d.origin).toEqual([]);
		expect(d.choices).toEqual([]);
		expect(d.introductions).toEqual([]);
	});

	it("defaults choiceValues to empty object and specialPossessions to null", () => {
		const d = new PlaybookData();
		expect(d.choiceValues).toEqual({});
		expect(d.specialPossessions).toBeNull();
	});
});
