import { describe, it, expect } from "vitest";
import { adviceRange } from "../../../scripts/import/pdf/build-advice.js";

// The spread sits at outline depth 2 — a section of "Playing the Game", not a chapter of its own —
// which is why articleRanges (chapters only) can't bound it and this does.
const OUTLINE = [
	{ title: "Gear and possessions", pdfPage: 44, depth: 2 },
	{ title: "If you want to...",    pdfPage: 50, depth: 2 },
	{ title: "Playbooks & Inserts",  pdfPage: 52, depth: 1 },
];

describe("adviceRange", () => {
	it("runs from the article's own page to the page before whatever follows", () => {
		expect(adviceRange(OUTLINE)).toEqual({ title: "If you want to...", pdfPage: 50, endPage: 51 });
	});

	it("ignores outline entries on the same page as the article", () => {
		const shared = [...OUTLINE.slice(0, 2), { title: "Sidebar", pdfPage: 50, depth: 3 }, OUTLINE[2]];
		expect(adviceRange(shared).endPage).toBe(51);
	});

	// A reprint that drops or renames the section should stop the build, not write a partial page.
	it("refuses an outline without the article", () => {
		expect(() => adviceRange([OUTLINE[0]])).toThrow(/no "If you want to…" entry/);
	});

	it("refuses an article it cannot bound", () => {
		expect(() => adviceRange(OUTLINE.slice(0, 2))).toThrow(/cannot bound it/);
	});
});
