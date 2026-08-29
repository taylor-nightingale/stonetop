import { describe, it, expect } from "vitest";
import { spliceGlyph, joinMarkerSplitLines } from "../../../scripts/import/pdf/load.js";

// A stext line the way parseStext yields it: spans carry per-character x positions. Mirrors the
// Rhoillyg Orchard requirement, where the ◇ weight diamond sits in the gap the book leaves between
// "A" and "sack" (one mutool line, so only a char-level splice can place it correctly).
function sackLine() {
	const text = "A  sack";
	const xs = [231, 234, 240, 244, 248, 252, 256];
	return { bbox: [231, 100, 300, 109], text, font: "ACaslonPro-Regular", size: 9, spans: [{ font: "ACaslonPro-Regular", size: 9, text, xs }] };
}

describe("spliceGlyph", () => {
	it("splices the glyph at the character whose x is at/right of the marker", () => {
		const line = sackLine();
		expect(spliceGlyph(line, 236.7, "◇")).toBe(true);
		expect(line.spans[0].text).toBe("A ◇ sack");
		expect(line.text).toBe("A ◇ sack");
	});

	it("records the glyph's x so a second marker on the same line lands after it (\"◇◇\")", () => {
		const line = sackLine();
		spliceGlyph(line, 236.7, "◇");
		spliceGlyph(line, 238.5, "◇");
		expect(line.text).toBe("A ◇◇ sack");
	});

	it("splices across span boundaries into the right font run", () => {
		const line = {
			bbox: [0, 0, 100, 9], text: "an acorn", font: "r", size: 9,
			spans: [
				{ font: "r", size: 9, text: "an ", xs: [0, 4, 8] },
				{ font: "b", size: 9, text: "acorn", xs: [20, 24, 28, 32, 36] },
			],
		};
		expect(spliceGlyph(line, 19, "◇")).toBe(true);
		expect(line.spans[1].text).toBe("◇acorn");
		expect(line.text).toBe("an ◇acorn");
	});

	it("returns false when every character sits left of the marker (caller falls back)", () => {
		const line = sackLine();
		expect(spliceGlyph(line, 999, "◇")).toBe(false);
		expect(line.text).toBe("A  sack");
	});

	it("returns false for spans without x data (injected pseudo-lines)", () => {
		const line = { bbox: [0, 0, 10, 9], text: "◇", font: "marker", size: 7, spans: [{ font: "marker", size: 7, text: "◇" }] };
		expect(spliceGlyph(line, 5, "◇")).toBe(false);
	});
});

// A vector mark drawn mid-sentence ends the stext line, so its tail arrives as a second line on the
// same baseline. Mirrors Noruba's Ice Sphere (Book II p.274), where the tail starts far enough right
// that orderColumns files it under the NEXT column and it never reaches its move.
const textLine = (text, x0, x1, y0 = 179) => {
	const step = (x1 - x0) / text.length;
	const xs = [...text].map((_, i) => x0 + i * step);
	return { bbox: [x0, y0, x1, y0 + 8], text, font: "ACaslonPro-Regular", size: 8, spans: [{ font: "ACaslonPro-Regular", size: 8, text, xs }] };
};
const splitRow = () => ([
	textLine("  Manipulate an unattended item (small or ", 436.5, 579.6),
	textLine(", no bigger)", 586.0, 622.4),
]);
const diamond = { x: 579.8, y: 182.3, w: 5.9, h: 5.9, kind: "diamond" };

describe("joinMarkerSplitLines", () => {
	it("joins the tail onto its head and places the mark in the gap it was drawn in", () => {
		const lines = splitRow();
		expect(joinMarkerSplitLines(lines, [diamond]).has(diamond)).toBe(true);
		expect(lines).toHaveLength(1);
		expect(lines[0].text).toBe("  Manipulate an unattended item (small or ◇, no bigger)");
		expect(lines[0].bbox[2]).toBe(622.4);
	});

	it("leaves a wide gap alone — that's a table's cells or a column boundary, not a split line", () => {
		const lines = splitRow();
		lines[1] = textLine(", no bigger)", 620, 660); // the mark no longer fills the gap
		expect(joinMarkerSplitLines(lines, [diamond]).size).toBe(0);
		expect(lines).toHaveLength(2);
	});

	it("leaves lines on different baselines alone", () => {
		const lines = splitRow();
		lines[1] = textLine(", no bigger)", 586.0, 622.4, 190);
		expect(joinMarkerSplitLines(lines, [diamond]).size).toBe(0);
		expect(lines).toHaveLength(2);
	});

	it("ignores a square checkbox — it leads its item, it never interrupts a sentence", () => {
		const lines = splitRow();
		expect(joinMarkerSplitLines(lines, [{ ...diamond, kind: "square" }]).size).toBe(0);
		expect(lines).toHaveLength(2);
	});

	it("ignores injected pseudo-lines (a swirl bullet carries no per-character x data)", () => {
		const lines = splitRow();
		lines[0].spans = [{ font: "swirl", size: 7, text: "" }];
		expect(joinMarkerSplitLines(lines, [diamond]).size).toBe(0);
		expect(lines).toHaveLength(2);
	});
});
