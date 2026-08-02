import { describe, it, expect } from "vitest";
import { richTextToHtml } from "../../src/migration/richTextToHtml.js";

describe("richTextToHtml", () => {
	it("wraps a single line in a paragraph", () => {
		expect(richTextToHtml("A wanderer.")).toBe("<p>A wanderer.</p>");
	});

	it("keeps single newlines as line breaks inside one paragraph", () => {
		expect(richTextToHtml("Line one\nLine two")).toBe("<p>Line one<br>Line two</p>");
	});

	it("splits blank-line-separated blocks into paragraphs", () => {
		expect(richTextToHtml("First.\n\nSecond.")).toBe("<p>First.</p><p>Second.</p>");
	});

	it("renders markdown emphasis", () => {
		expect(richTextToHtml("A **bold** claim")).toBe("<p>A <strong>bold</strong> claim</p>");
	});

	it("leaves Foundry tokens as source text (no auto-rolled dice)", () => {
		expect(richTextToHtml("Deals d6 with [[/r 2d6]] and @UUID[Actor.x]{Bob}"))
			.toBe("<p>Deals d6 with [[/r 2d6]] and @UUID[Actor.x]{Bob}</p>");
	});

	it("returns already-HTML values untouched", () => {
		const html = "<p>Saved by the editor</p><ul><li>a</li></ul>";
		expect(richTextToHtml(html)).toBe(html);
	});

	it("is idempotent", () => {
		const once = richTextToHtml("First.\n\nSecond.");
		expect(richTextToHtml(once)).toBe(once);
	});

	it("returns an empty string for blank, null, and undefined input", () => {
		expect(richTextToHtml("   \n  ")).toBe("");
		expect(richTextToHtml(null)).toBe("");
		expect(richTextToHtml(undefined)).toBe("");
	});
});
