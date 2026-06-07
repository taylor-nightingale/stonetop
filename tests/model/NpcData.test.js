import { describe, it, expect } from "vitest";
import { NpcData } from "../../src/data/NpcData.js";

describe("NpcData defaults", () => {
	it("defaults hp, maxHp, armor to 0", () => {
		const d = new NpcData();
		expect(d.hp).toBe(0);
		expect(d.maxHp).toBe(0);
		expect(d.armor).toBe(0);
	});

	it("defaults damage to 'd6'", () => {
		expect(new NpcData().damage).toBe("d6");
	});

	it("defaults description, notes, specialQuality, instinct to empty string", () => {
		const d = new NpcData();
		expect(d.description).toBe("");
		expect(d.notes).toBe("");
		expect(d.specialQuality).toBe("");
		expect(d.instinct).toBe("");
	});
});

describe("NpcData with initial data", () => {
	it("accepts hp, maxHp, armor values", () => {
		const d = new NpcData({ hp: 8, maxHp: 12, armor: 2 });
		expect(d.hp).toBe(8);
		expect(d.maxHp).toBe(12);
		expect(d.armor).toBe(2);
	});

	it("accepts damage die string", () => {
		expect(new NpcData({ damage: "d10" }).damage).toBe("d10");
	});

	it("accepts description and instinct", () => {
		const d = new NpcData({ description: "A creature.", instinct: "to hunt" });
		expect(d.description).toBe("A creature.");
		expect(d.instinct).toBe("to hunt");
	});
});

describe("NpcData.migrateData", () => {
	it("coerces PBTA-format hp object to flat number", () => {
		const source = { hp: { value: 8, min: 0, max: 12 } };
		NpcData.migrateData(source);
		expect(source.hp).toBe(8);
	});

	it("coerces PBTA-format armor object to flat number", () => {
		const source = { armor: { value: 2, note: "plate" } };
		NpcData.migrateData(source);
		expect(source.armor).toBe(2);
	});

	it("falls back to 0 when PBTA object has no value field", () => {
		const source = { hp: {}, armor: {} };
		NpcData.migrateData(source);
		expect(source.hp).toBe(0);
		expect(source.armor).toBe(0);
	});

	it("leaves flat numbers unchanged", () => {
		const source = { hp: 10, armor: 3 };
		NpcData.migrateData(source);
		expect(source.hp).toBe(10);
		expect(source.armor).toBe(3);
	});

	it("leaves null hp and armor unchanged", () => {
		const source = { hp: null, armor: null };
		NpcData.migrateData(source);
		expect(source.hp).toBeNull();
		expect(source.armor).toBeNull();
	});
});
