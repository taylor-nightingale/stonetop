import { describe, it, expect } from "vitest";
import { ArcanumData } from "../../src/data/ArcanumData.js";

describe("ArcanumData defaults", () => {
	it("defaults weight to 1 and major to false", () => {
		const d = new ArcanumData();
		expect(d.weight).toBe(1);
		expect(d.major).toBe(false);
	});

	it("defaults description to empty string", () => {
		expect(new ArcanumData().description).toBe("");
	});

	it("defaults slug and sortOrder to null", () => {
		const d = new ArcanumData();
		expect(d.slug).toBeNull();
		expect(d.sortOrder).toBeNull();
	});

	it("defaults front and back to null", () => {
		const d = new ArcanumData();
		expect(d.front).toBeNull();
		expect(d.back).toBeNull();
	});
});
