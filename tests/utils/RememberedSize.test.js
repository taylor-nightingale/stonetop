import { describe, it, expect } from "vitest";
import { RememberedSize } from "../../src/utils/RememberedSize.js";
import { SheetSize } from "../../src/utils/SheetSize.js";

describe("RememberedSize", () => {
	it("round-trips a size and the setting it was chosen at", () => {
		const remembered = RememberedSize.fromObject({ width: 900, height: 700, rootFontSizePx: 32 });
		expect(remembered.size.toObject()).toEqual({ width: 900, height: 700 });
		expect(remembered.rootFontSizePx).toBe(32);
		expect(remembered.toObject()).toEqual({ width: 900, height: 700, rootFontSizePx: 32 });
	});

	it("is convertible only when it knows its own setting", () => {
		expect(new RememberedSize(new SheetSize(900, 700), 32).isConvertible).toBe(true);
		expect(new RememberedSize(new SheetSize(900, 700)).isConvertible).toBe(false);
	});

	it("accepts an entry stored before the setting was recorded", () => {
		// These predate the field; they must still restore, just without conversion.
		const remembered = RememberedSize.fromObject({ width: 900, height: 700 });
		expect(remembered.size.toObject()).toEqual({ width: 900, height: 700 });
		expect(remembered.isConvertible).toBe(false);
	});

	it.each([
		["zero", 0],
		["negative", -16],
		["non-finite", Infinity],
		["not a number", "32px"]
	])("treats a %s setting as unknown rather than trusting it", (_label, px) => {
		expect(RememberedSize.fromObject({ width: 900, height: 700, rootFontSizePx: px }).isConvertible).toBe(false);
	});

	it("is null when there is no valid size to remember", () => {
		expect(RememberedSize.fromObject(null)).toBeNull();
		expect(RememberedSize.fromObject({ width: "auto", height: 700 })).toBeNull();
	});
});
