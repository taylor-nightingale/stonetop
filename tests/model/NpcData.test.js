import { describe, it, expect } from "vitest";
import { NpcData } from "../../src/data/NpcData.js";

describe("NpcData defaults (composed creature core)", () => {
	it("defaults hp to { value: 0, max: 0 }", () => {
		const d = new NpcData();
		expect(d.hp.value).toBe(0);
		expect(d.hp.max).toBe(0);
	});

	it("defaults armor to empty string", () => {
		expect(new NpcData().armor).toBe("");
	});

	it("defaults damage to empty prose string", () => {
		expect(new NpcData().damage).toBe("");
	});

	it("defaults tags to an empty multi-selection and the rest to empty string", () => {
		const d = new NpcData();
		expect(d.tagList.selected).toEqual([]);
		expect(d.tagList.multi).toBe(true);
		expect(d.instinct.selected).toEqual([]);
		expect(d.instinct.multi).toBe(false);
		expect(d.specialQuality).toBe("");
		expect(d.description).toBe("");
		expect(d.notes).toBe("");
	});

	it("defaults slug and reference to null", () => {
		const d = new NpcData();
		expect(d.slug).toBeNull();
		expect(d.reference).toBeNull();
	});

	it("does not carry follower bookkeeping", () => {
		const d = new NpcData();
		expect(d.loyalty).toBeUndefined();
		expect(d.owned).toBeUndefined();
		expect(d.choices).toBeUndefined();
	});
});

describe("NpcData with initial data", () => {
	it("accepts an hp object and a prose armor string", () => {
		const d = new NpcData({ hp: { value: 8, max: 12 }, armor: "2 (scales)" });
		expect(d.hp.value).toBe(8);
		expect(d.hp.max).toBe(12);
		expect(d.armor).toBe("2 (scales)");
	});

	it("accepts a prose damage string", () => {
		expect(new NpcData({ damage: "mighty blows d12+3 (forceful)" }).damage)
			.toBe("mighty blows d12+3 (forceful)");
	});
});
