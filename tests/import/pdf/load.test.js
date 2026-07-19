import { describe, it, expect } from "vitest";
import { spliceGlyph } from "../../../scripts/import/pdf/load.js";

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
