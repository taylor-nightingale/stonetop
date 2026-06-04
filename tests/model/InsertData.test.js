import { describe, it, expect } from "vitest";
import { InsertData } from "../../src/data/InsertData.js";

describe("InsertData defaults", () => {
	it("defaults slug to null", () => {
		expect(new InsertData().slug).toBeNull();
	});

	it("defaults description to empty string", () => {
		expect(new InsertData().description).toBe("");
	});

	it("defaults instinct to null", () => {
		expect(new InsertData().instinct).toBeNull();
	});

	it("defaults choices to empty array", () => {
		expect(new InsertData().choices).toEqual([]);
	});
});
