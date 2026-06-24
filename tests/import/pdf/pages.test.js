import { describe, it, expect } from "vitest";
import { formatPageRange } from "../../../scripts/import/pdf/pages.js";

describe("formatPageRange", () => {
	it("collapses a consecutive run into a single range", () => {
		expect(formatPageRange([22, 23, 24, 25])).toBe("22-25");
		expect(formatPageRange([62, 63])).toBe("62-63");
	});
	it("keeps gaps as separate items", () => {
		expect(formatPageRange([22, 23, 25])).toBe("22-23, 25");
		expect(formatPageRange([1, 3, 4, 5, 9])).toBe("1, 3-5, 9");
	});
	it("dedupes and sorts", () => {
		expect(formatPageRange([13, 12, 12, 13])).toBe("12-13");
	});
	it("handles single and empty", () => {
		expect(formatPageRange([7])).toBe("7");
		expect(formatPageRange([])).toBe("");
	});
});
