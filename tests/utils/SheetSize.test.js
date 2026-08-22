import { describe, it, expect } from "vitest";
import { SheetSize } from "../../src/utils/SheetSize.js";

describe("SheetSize", () => {
	it("round-trips a valid size through fromObject/toObject", () => {
		const size = SheetSize.fromObject({ width: 1000, height: 700 });
		expect(size).toBeInstanceOf(SheetSize);
		expect(size.toObject()).toEqual({ width: 1000, height: 700 });
	});

	it("returns null for a missing object", () => {
		expect(SheetSize.fromObject(null)).toBeNull();
		expect(SheetSize.fromObject(undefined)).toBeNull();
	});

	it("returns null when a dimension is missing", () => {
		expect(SheetSize.fromObject({ width: 1000 })).toBeNull();
		expect(SheetSize.fromObject({ height: 700 })).toBeNull();
	});

	it("returns null for non-positive or non-finite dimensions", () => {
		expect(SheetSize.fromObject({ width: 0, height: 700 })).toBeNull();
		expect(SheetSize.fromObject({ width: -5, height: 700 })).toBeNull();
		expect(SheetSize.fromObject({ width: 1000, height: Infinity })).toBeNull();
		expect(SheetSize.fromObject({ width: NaN, height: 700 })).toBeNull();
	});

	it("returns null when a dimension is not a number (e.g. Foundry's 'auto')", () => {
		expect(SheetSize.fromObject({ width: "auto", height: 700 })).toBeNull();
		expect(SheetSize.fromObject({ width: 1000, height: "auto" })).toBeNull();
	});
});

describe("SheetSize#clampedTo", () => {
	const size = () => new SheetSize(1000, 700);

	it("returns the same instance when it already fits", () => {
		const original = size();
		expect(original.clampedTo(1200, 900)).toBe(original);
	});

	it("shrinks each dimension that exceeds its bound", () => {
		expect(size().clampedTo(800, 600).toObject()).toEqual({ width: 800, height: 600 });
	});

	it("clamps only the dimension that overflows", () => {
		expect(size().clampedTo(800, 900).toObject()).toEqual({ width: 800, height: 700 });
		expect(size().clampedTo(1200, 600).toObject()).toEqual({ width: 1000, height: 600 });
	});

	it("rounds a fractional bound to whole pixels", () => {
		expect(size().clampedTo(799.4, 700).toObject()).toEqual({ width: 799, height: 700 });
	});

	it("ignores bounds that are not usable dimensions", () => {
		// A viewport that cannot be measured must not collapse the sheet to nothing.
		for (const bound of [undefined, null, 0, -100, NaN, Infinity, "800"]) {
			expect(size().clampedTo(bound, bound).toObject()).toEqual({ width: 1000, height: 700 });
		}
	});

	it("does not mutate the original", () => {
		const original = size();
		original.clampedTo(500, 500);
		expect(original.toObject()).toEqual({ width: 1000, height: 700 });
	});
});
