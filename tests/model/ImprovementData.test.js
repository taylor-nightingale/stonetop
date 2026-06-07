import { describe, it, expect } from "vitest";
import { ImprovementData } from "../../src/data/ImprovementData.js";

describe("ImprovementData defaults", () => {
	it("defaults slug to null", () => {
		expect(new ImprovementData().slug).toBeNull();
	});

	it("defaults sortOrder to null", () => {
		expect(new ImprovementData().sortOrder).toBeNull();
	});

	it("defaults choices to null", () => {
		expect(new ImprovementData().choices).toBeNull();
	});
});
