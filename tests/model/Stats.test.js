import { describe, expect, it } from "vitest";
import { Stats } from "../../src/model/data/character/Stats.js";

describe("Stats", () => {
	it("named getters return the provided value for each stat", () => {
		const s = new Stats({ str: 2, dex: 1, con: 3, int: -1, wis: 0, cha: 2 });
		expect(s.str).toBe(2);
		expect(s.dex).toBe(1);
		expect(s.con).toBe(3);
		expect(s.int).toBe(-1);
		expect(s.wis).toBe(0);
		expect(s.cha).toBe(2);
	});

	it("get(key) returns the same value as the named property", () => {
		const s = new Stats({ con: 3 });
		expect(s.get("con")).toBe(3);
	});

	it("defaults to 0 for any stat not provided", () => {
		const s = new Stats({});
		for (const key of ["str", "dex", "con", "int", "wis", "cha"]) {
			expect(s.get(key)).toBe(0);
		}
	});

	it("get() returns 0 for an unknown key", () => {
		const s = new Stats({ str: 2 });
		expect(s.get("unknown")).toBe(0);
	});

	it("constructed with no arguments defaults all stats to 0", () => {
		const s = new Stats();
		expect(s.str).toBe(0);
		expect(s.cha).toBe(0);
	});
});
