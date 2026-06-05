import { describe, it, expect } from "vitest";
import { NpcItemData } from "../../src/data/NpcItemData.js";

describe("NpcItemData defaults", () => {
	it("defaults slug and arcanaSlug to null", () => {
		const d = new NpcItemData();
		expect(d.slug).toBeNull();
		expect(d.arcanaSlug).toBeNull();
	});

	it("defaults tags, specialQualities, instinct, description to empty string", () => {
		const d = new NpcItemData();
		expect(d.tags).toBe("");
		expect(d.specialQualities).toBe("");
		expect(d.instinct).toBe("");
		expect(d.description).toBe("");
	});

	it("defaults hp to 0/0/0", () => {
		const d = new NpcItemData();
		expect(d.hp.value).toBe(0);
		expect(d.hp.min).toBe(0);
		expect(d.hp.max).toBe(0);
	});

	it("defaults armor to value=0 and empty note", () => {
		const d = new NpcItemData();
		expect(d.armor.value).toBe(0);
		expect(d.armor.note).toBe("");
	});

	it("defaults damage die to null", () => {
		const d = new NpcItemData();
		expect(d.damage.die).toBeNull();
		expect(d.damage.label).toBe("");
		expect(d.damage.tags).toBe("");
	});

	it("defaults loyalty to value=0, max=3", () => {
		const d = new NpcItemData();
		expect(d.loyalty.value).toBe(0);
		expect(d.loyalty.max).toBe(3);
	});

	it("defaults choices to empty array", () => {
		expect(new NpcItemData().choices).toEqual([]);
	});
});
