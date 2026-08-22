import { describe, it, expect } from "vitest";
import { RootFontScale } from "../../src/utils/RootFontScale.js";
import { SheetSize } from "../../src/utils/SheetSize.js";

/** A stand-in document whose root reports `px`, with the getComputedStyle the class reads. */
function documentReporting(px) {
	const documentElement = {};
	globalThis.getComputedStyle = el => (el === documentElement ? { fontSize: px } : {});
	return { documentElement };
}

describe("RootFontScale", () => {
	it("is neutral at core's default font size", () => {
		expect(new RootFontScale(16).factor).toBe(1);
	});

	it.each([
		[8, 0.5],
		[24, 1.5],
		[32, 2]
	])("reports the factor for a %ipx root", (px, factor) => {
		expect(new RootFontScale(px).factor).toBe(factor);
	});

	it("scales a designed size to hold the same content", () => {
		const scaled = new RootFontScale(32).scale(new SheetSize(1160, 900));
		expect(scaled.toObject()).toEqual({ width: 2320, height: 1800 });
	});

	it("returns whole pixels, since a window position is measured in them", () => {
		const scaled = new RootFontScale(20).scale(new SheetSize(315, 425));
		expect(scaled.toObject()).toEqual({ width: 394, height: 531 });
	});

	it("leaves a designed size untouched at the baseline", () => {
		const size = new SheetSize(640, 620);
		expect(new RootFontScale(16).scale(size).toObject()).toEqual(size.toObject());
	});

	it("reads the live root font size from the document", () => {
		expect(RootFontScale.fromDocument(documentReporting("28px")).factor).toBe(1.75);
	});

	it.each([
		["an unmeasurable root", { documentElement: null }],
		["no document at all", null]
	])("falls back to the baseline given %s", (_label, doc) => {
		globalThis.getComputedStyle = () => ({});
		expect(RootFontScale.fromDocument(doc).factor).toBe(1);
	});

	it("falls back to the baseline when the root reports a nonsensical size", () => {
		expect(RootFontScale.fromDocument(documentReporting("0px")).factor).toBe(1);
		expect(RootFontScale.fromDocument(documentReporting("not-a-size")).factor).toBe(1);
	});
});
