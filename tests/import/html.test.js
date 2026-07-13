import { describe, it, expect } from "vitest";
import { escapeHtml, unescapeHtml, normalizeHtml, tag, toParagraphs, joinSections } from "../../scripts/import/html.js";

describe("escapeHtml", () => {
	it("escapes HTML-significant characters", () => {
		expect(escapeHtml(`a & b < c > "d" 'e'`)).toBe("a &amp; b &lt; c &gt; &quot;d&quot; &#39;e&#39;");
	});
});

describe("unescapeHtml", () => {
	it("inverts escapeHtml", () => {
		const text = `a & b < c > "d" 'e'`;
		expect(unescapeHtml(escapeHtml(text))).toBe(text);
	});
	it("leaves plain text and unknown entities alone", () => {
		expect(unescapeHtml("Crag Wyvern &copy;")).toBe("Crag Wyvern &copy;");
	});
});

describe("normalizeHtml", () => {
	it("returns '' for null/undefined", () => {
		expect(normalizeHtml(null)).toBe("");
		expect(normalizeHtml(undefined)).toBe("");
	});
	it("trims and collapses inter-tag whitespace", () => {
		expect(normalizeHtml("  <p>a</p>   <p>b</p>  ")).toBe("<p>a</p><p>b</p>");
	});
});

describe("tag", () => {
	it("wraps content", () => {
		expect(tag("h2", "Hooks")).toBe("<h2>Hooks</h2>");
	});
	it("drops empty content", () => {
		expect(tag("h2", "  ")).toBe("");
		expect(tag("h2", null)).toBe("");
	});
});

describe("toParagraphs", () => {
	it("passes through existing block HTML", () => {
		expect(toParagraphs("<p>already html</p>")).toBe("<p>already html</p>");
	});
	it("wraps blank-line-separated plain text and escapes it", () => {
		expect(toParagraphs("first & line\n\nsecond")).toBe("<p>first &amp; line</p><p>second</p>");
	});
	it("converts single newlines to <br>", () => {
		expect(toParagraphs("a\nb")).toBe("<p>a<br>b</p>");
	});
	it("returns '' for blank input", () => {
		expect(toParagraphs("   ")).toBe("");
	});
});

describe("joinSections", () => {
	it("joins non-empty fragments and drops blanks", () => {
		expect(joinSections("<p>a</p>", "", null, "<p>b</p>")).toBe("<p>a</p>\n<p>b</p>");
	});
});
