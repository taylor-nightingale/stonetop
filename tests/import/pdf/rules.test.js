import { describe, it, expect } from "vitest";
import { parseDividers, parseMarkers } from "../../../scripts/import/pdf/rules.js";

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

describe("parseMarkers", () => {
	// A small straight-sided ~square box (≥3 lineto) → "square" (the choice-group pick/track checkbox).
	const square = `<stroke_path color="0 0 0" transform="1 0 0 -1 600 313">` +
		`<moveto x="0" y="0"/><lineto x="6" y="0"/><lineto x="6" y="-6"/><lineto x="0" y="-6"/><lineto x="0" y="0"/></stroke_path>`;
	// A curved outline filling its bbox → "circle"; a curved outline filling ~half → "diamond".
	const circle = `<stroke_path color="0 0 0" transform="1 0 0 -1 100 200">` +
		`<moveto x="0" y="0"/><curveto x1="6" y1="0" x2="6" y2="-6" x3="0" y3="-6"/>` +
		`<curveto x1="0" y1="-6" x2="0" y2="0" x3="6" y3="0"/><curveto x1="6" y1="0" x2="3" y2="-3" x3="6" y3="-6"/></stroke_path>`;
	const diamond = `<stroke_path color="0 0 0" transform="1 0 0 -1 50 80">` +
		`<moveto x="3" y="0"/><curveto x1="3" y1="0" x2="6" y2="-3" x3="6" y3="-3"/>` +
		`<curveto x1="6" y1="-3" x2="3" y2="-6" x3="3" y3="-6"/><curveto x1="3" y1="-6" x2="0" y2="-3" x3="0" y3="-3"/></stroke_path>`;

	it("detects square checkboxes (straight-sided box)", () => {
		expect(parseMarkers(square)).toEqual([{ x: 600, y: 313, w: 6, h: 6, kind: "square" }]);
	});

	it("classifies curved outlines as circle (fills bbox) vs diamond (fills ~half)", () => {
		expect(parseMarkers(circle)[0].kind).toBe("circle");
		expect(parseMarkers(diamond)[0].kind).toBe("diamond");
	});

	it("classifies a rotated straight-sided square (the artifact weight pip) as diamond", () => {
		// Vertices at the bbox edge midpoints — the hull fills ~half the bbox, unlike an upright
		// checkbox whose corners fill it entirely. Shape taken from a Book II artifact tag line.
		const pip = `<stroke_path color="0 0 0" transform="1 0 0 -1 49.48 302.69">` +
			`<moveto x="0" y="0"/><lineto x="3.309" y="-3.309"/><lineto x="6.618" y="0"/>` +
			`<lineto x="3.309" y="3.309"/><lineto x="0" y="0"/></stroke_path>`;
		expect(parseMarkers(pip)[0].kind).toBe("diamond");
	});

	// Book I draws the Common-items load diamond as three curves closed by a `lineto` back to the
	// start — Book II's is all curves. Both are the same ◇, so both must read as one.
	it("reads a curved diamond closed by a single lineto as a diamond", () => {
		const bookI = `<stroke_path color="0 0 0" transform="1 0 0 -1 600 106">` +
			`<moveto x="0" y="0"/>` +
			`<curveto x1=".985" y1="-.985" x2="1.97" y2="-1.97" x3="2.956" y3="-2.956"/>` +
			`<curveto x1="3.941" y1="-1.97" x2="4.926" y2="-.985" x3="5.911" y3="0"/>` +
			`<curveto x1="4.926" y1=".985" x2="3.941" y2="1.97" x3="2.956" y3="2.956"/>` +
			`<lineto x="0" y="0"/></stroke_path>`;
		expect(parseMarkers(bookI)[0].kind).toBe("diamond");
	});

	// …and a third construction: two curves with two straight sides, the ◇ Book I sets inline in prose
	// ("A ◇ purse of copper coins").
	it("reads a two-curve, two-line diamond as a diamond", () => {
		const inline = `<stroke_path color="0 0 0" transform="1 0 0 -1 226.7 324.5">` +
			`<moveto x="0" y="0"/><lineto x="3.353" y="-3.353"/>` +
			`<curveto x1="4.47" y1="-2.235" x2="5.588" y2="-1.118" x3="6.706" y3="0"/>` +
			`<lineto x="3.353" y="3.353"/>` +
			`<curveto x1="2.235" y1="2.235" x2="1.118" y2="1.118" x3="0" y3="0"/></stroke_path>`;
		expect(parseMarkers(inline)[0].kind).toBe("diamond");
	});

	it("ignores white markers and oblong (non-square) straight shapes", () => {
		expect(parseMarkers(square.replace('color="0 0 0"', 'color="1 1 1"'))).toEqual([]);
		const oblong = `<stroke_path color="0 0 0" transform="1 0 0 -1 600 313">` +
			`<moveto x="0" y="0"/><lineto x="14" y="0"/><lineto x="14" y="-3"/><lineto x="0" y="-3"/><lineto x="0" y="0"/></stroke_path>`;
		expect(parseMarkers(oblong)).toEqual([]);
	});
});
