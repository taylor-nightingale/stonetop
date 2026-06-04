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
