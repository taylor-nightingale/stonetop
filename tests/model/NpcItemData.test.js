import { describe, it, expect } from "vitest";
import { NpcItemData } from "../../src/data/NpcItemData.js";

describe("NpcItemData defaults (creature core + follower fields)", () => {
	it("defaults slug, arcanaSlug, reference to null", () => {
		const d = new NpcItemData();
		expect(d.slug).toBeNull();
		expect(d.arcanaSlug).toBeNull();
		expect(d.reference).toBeNull();
	});

	it("defaults tags to an empty multi-selection and the rest to empty string", () => {
		const d = new NpcItemData();
		expect(d.tags.selected).toEqual([]);
		expect(d.tags.multi).toBe(true);
		expect(d.specialQuality).toBe("");
		expect(d.instinct).toBe("");
		expect(d.description).toBe("");
		expect(d.notes).toBe("");
	});

	it("defaults hp to { value: 0, max: 0 }", () => {
		const d = new NpcItemData();
		expect(d.hp.value).toBe(0);
		expect(d.hp.max).toBe(0);
		expect(d.hp.min).toBeUndefined();
	});

	it("defaults armor to empty string", () => {
		expect(new NpcItemData().armor).toBe("");
	});

	it("defaults damage to empty prose string", () => {
		expect(new NpcItemData().damage).toBe("");
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
