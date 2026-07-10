import { describe, it, expect } from "vitest";
import { largestIllustration } from "../../../scripts/import/pdf/steading-art.js";

const img = ({ w = 400, h = 400, file = "x.png" } = {}) => ({ file, x: 0, y: 0, w, h });

describe("largestIllustration", () => {
	it("returns the largest image by area above the threshold", () => {
		const small = img({ w: 150, h: 120, file: "small.png" });
		const big = img({ w: 400, h: 400, file: "big.png" });
		expect(largestIllustration([small, big])).toBe(big);
	});
	it("ignores sub-threshold images (chrome / bullets)", () => {
		expect(largestIllustration([img({ w: 60, h: 60 })])).toBeNull();
	});
	it("returns null for no images", () => {
		expect(largestIllustration([])).toBeNull();
		expect(largestIllustration(undefined)).toBeNull();
	});
});
