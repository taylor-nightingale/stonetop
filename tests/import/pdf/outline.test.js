import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { parseOutline, articleRanges } from "../../../scripts/import/pdf/outline.js";

const raw = readFileSync(fileURLToPath(new URL("./fixtures/outline.txt", import.meta.url)), "utf8");

describe("parseOutline", () => {
	const entries = parseOutline(raw);

	it("parses title, page, and depth", () => {
		expect(entries[0]).toEqual({ title: "Contents", pdfPage: 3, depth: 1 });
		expect(entries.find((e) => e.title === "The village of Stonetop")).toEqual({
			title: "The village of Stonetop", pdfPage: 7, depth: 1,
		});
	});

	it("captures nested Maps children at depth 2", () => {
		const vicinity = entries.find((e) => e.title === "The Vicinity");
		expect(vicinity).toEqual({ title: "The Vicinity", pdfPage: 5, depth: 2 });
	});
});

describe("articleRanges", () => {
	const ranges = articleRanges(parseOutline(raw), 302);
	const byTitle = Object.fromEntries(ranges.map((r) => [r.title, r]));

	it("drops Contents, Maps (+children), INDEX, and arcana appendices C/D", () => {
		const titles = ranges.map((r) => r.title);
		expect(titles).not.toContain("Contents");
		expect(titles).not.toContain("Maps");
		expect(titles).not.toContain("The Vicinity");
		expect(titles).not.toContain("INDEX");
		expect(titles.some((t) => /APPENDIX [CD]/i.test(t))).toBe(false);
	});

	it("keeps the gazetteer articles and appendices A/B in book order, village first", () => {
		expect(ranges[0].title).toBe("Welcome to the World's End");
		expect(ranges[1].title).toBe("The village of Stonetop");
		expect(byTitle["APPENDIX A: Ages of the World"]).toBeDefined();
		expect(byTitle["APPENDIX B: Artifact Creation"]).toBeDefined();
	});

	it("derives each article's page range from the next top-level entry's start", () => {
		// Aratis starts pg 12, Barrier Pass pg 14 → Aratis spans 12–13.
		expect(byTitle["Aratis, the Lawkeeper"]).toEqual({ title: "Aratis, the Lawkeeper", pdfPage: 12, endPage: 13 });
		// The Crombil pg 32, Danu pg 33 → single spread.
		expect(byTitle["The Crombil"]).toEqual({ title: "The Crombil", pdfPage: 32, endPage: 32 });
	});

	it("bounds the last kept article by the next (skipped) entry, not the doc end", () => {
		// Appendix B (250) is last kept; Appendix C starts 255 → B spans 250–254.
		expect(byTitle["APPENDIX B: Artifact Creation"].endPage).toBe(254);
	});
});
