import { describe, it, expect } from "vitest";
import { detectFooters, cardRegions, gridCards } from "../../../scripts/import/pdf/minor-arcana-grid.js";

// Synthetic stext lines matching the book's minor-appendix geometry (Avara titles/numbers, Fell
// front/back side-labels). bbox = [x0, y0, x1, y1].
const line = (text, x, y, font, size = 8) => ({ text, font, size, bbox: [x, y, x + 40, y + size], spans: [{ text, font, size }] });
const avara = (text, x, y, size = 8) => line(text, x, y, "Avara-Bold", size);
const fell = (text, x, y) => line(text, x, y, "Historical-FellTypeRoman", 8);
const body = (text, x, y) => line(text, x, y, "ACaslonPro-Regular", 8);

// One card footer: front label, number, back label symmetric about the card center cx.
const footer = (numText, cx, y) => [fell("front", cx - 16, y), avara(numText, cx - 3, y - 2), fell("back", cx + 16, y)];

// A page with two card rows × two cards (the standard 4-per-page layout).
const page = () => ({
	width: 792,
	lines: [
		// row 1 titles (top)
		avara("Front One", 60, 80), avara("Back One", 210, 80),
		avara("Front Two", 450, 80), avara("Back Two", 620, 80),
		body("body a", 60, 120), body("body b", 210, 120),
		// row 1 footers (cards 1 and 3)
		...footer("1", 188, 311), ...footer("3", 584, 311),
		// row 2 titles
		avara("Front Two-A", 60, 333), avara("Back Two-A", 210, 333),
		// row 2 footers (cards 2 and 4)
		...footer("2", 188, 563), ...footer("4", 584, 563),
	],
});

describe("detectFooters", () => {
	it("finds each front/number/back strip as a card footer", () => {
		const f = detectFooters(page());
		expect(f.map((c) => c.number)).toEqual([1, 3, 2, 4]); // sorted by y then x
		expect(f[0].centerX).toBeCloseTo(188, 0);
		expect(f[0].y).toBe(311);
	});
	it("ignores a front label with no matching back", () => {
		const p = { width: 792, lines: [fell("front", 100, 300), avara("5", 118, 298)] };
		expect(detectFooters(p)).toEqual([]);
	});
});

describe("cardRegions", () => {
	it("splits each card into front (left of center) and back (right of center)", () => {
		const [c1] = cardRegions(page());
		expect(c1.number).toBe(1);
		expect(c1.front.x1).toBeCloseTo(188, 0); // split at the footer center
		expect(c1.back.x0).toBeCloseTo(188, 0);
		expect(c1.front.x0).toBe(0);             // first card starts at the page left edge
		expect(c1.back.x1).toBeCloseTo(386, 0);  // divide with the next card at the center midpoint
	});
	it("bands rows vertically: content sits above its footer, below the previous row", () => {
		const rows = cardRegions(page());
		const row1 = rows.find((c) => c.number === 1), row2 = rows.find((c) => c.number === 2);
		expect(row1.front.y1).toBeLessThan(311);   // row-1 content ends above the row-1 footer
		expect(row2.front.y0).toBeGreaterThan(311); // row-2 content starts below the row-1 footer
	});
	it("returns nothing when the page has no footers", () => {
		expect(cardRegions({ width: 792, lines: [body("just prose", 60, 100)] })).toEqual([]);
	});
});

describe("gridCards", () => {
	it("pairs each card's front and back title by number", () => {
		const cards = gridCards(page());
		const c1 = cards.find((c) => c.number === 1);
		expect(c1.frontTitle).toBe("Front One");
		expect(c1.backTitle).toBe("Back One");
	});
});
