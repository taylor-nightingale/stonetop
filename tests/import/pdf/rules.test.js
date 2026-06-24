import { describe, it, expect } from "vitest";
import { parseDividers } from "../../../scripts/import/pdf/rules.js";

const stroke = (color, e, f, w) =>
	`<stroke_path linewidth=".5" colorspace="DeviceRGB" color="${color}" transform="1 0 0 -1 ${e} ${f}">` +
	`<moveto x="0" y="0"/><lineto x="${w}" y="0"/></stroke_path>`;
const braid = (e, f, w, h) =>
	`<fill_image_mask transform="${w} 0 -0 2.9 ${e} ${f}" colorspace="DeviceRGB" color="0 0 0" width="651" height="${h}"/>`;

describe("parseDividers", () => {
	it("keeps black, full-width horizontal strokes as line dividers at (e, f)", () => {
		expect(parseDividers(stroke("0 0 0", 204, 106, 156))).toEqual([{ x: 204, y: 106, width: 156, kind: "line" }]);
	});

	it("keeps braid image masks as braid dividers", () => {
		expect(parseDividers(braid(204, 83, 156, 13))).toEqual([{ x: 204, y: 83, width: 156, kind: "braid" }]);
	});

	it("drops white (decorative) strokes and narrow table-internal lines", () => {
		expect(parseDividers(stroke("1 1 1", 36, 326, 156))).toEqual([]);
		expect(parseDividers(stroke("0 0 0", 63, 326, 127))).toEqual([]);
	});

	it("drops non-horizontal strokes", () => {
		const diag = `<stroke_path color="0 0 0" transform="1 0 0 -1 36 100"><moveto x="0" y="0"/><lineto x="156" y="40"/></stroke_path>`;
		expect(parseDividers(diag)).toEqual([]);
	});
});
