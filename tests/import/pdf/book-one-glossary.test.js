import { describe, it, expect } from "vitest";
import { renderGlossary, replaceGlossary } from "../../../scripts/import/pdf/book-one.js";

// The book sets "Gear terms & tags" as a glossary — term on its own line, definition indented under
// it. The column parser has no reason to know that and runs all twenty-five together into one
// paragraph, so the terms are rebuilt from the same parse the tag glossary uses.

const entry = (label, definition, kind = "tag", category = "general") => ({ label, definition, kind, category });

describe("renderGlossary", () => {
	it("pairs each term with its definition in the markup, not just the spacing", () => {
		const html = renderGlossary([entry("area", "affects everything in an area.")]);
		expect(html).toBe('<dl class="gear-terms"><dt><em>area</em></dt><dd>affects everything in an area.</dd></dl>');
	});

	// The book's own split: a tag is set in italics, a mechanical modifier in roman.
	it("sets a tag in italics and a modifier upright", () => {
		const html = renderGlossary([entry("[n] armor", "subtract n.", "modifier")]);
		expect(html).toContain("<dt>[n] armor</dt>");
		expect(html).not.toContain("<em>[n] armor</em>");
	});

	it("escapes a term the book writes with markup characters", () => {
		expect(renderGlossary([entry("a & b", "x")])).toContain("<dt><em>a &amp; b</em></dt>");
	});

	it("renders nothing for no entries", () => {
		expect(renderGlossary([])).toBe("");
	});
});

describe("replaceGlossary", () => {
	const run = "<p><strong><em>area</em></strong>: a. <strong><em>crude</em></strong>: b.</p>";
	const rangeRun = "<p><strong><em>hand</em></strong>: h. <strong><em>far</em></strong>: f.</p>";
	const entries = [
		entry("area", "affects everything in an area."),
		entry("hand", "tight quarters.", "tag", "range"),
	];

	it("puts the general terms before the Range Tags heading and the range ones after", () => {
		const html = replaceGlossary(`<p>intro</p>${run}<h3>Range Tags</h3>${rangeRun}`, entries);
		const general = html.slice(0, html.indexOf("<h3>Range Tags</h3>"));
		expect(general).toContain("affects everything in an area.");
		expect(general).not.toContain("tight quarters.");
		expect(html.slice(html.indexOf("<h3>Range Tags</h3>"))).toContain("tight quarters.");
	});

	// The sidebar opens by explaining the load slots, which is prose, not a term — the parser does
	// not carry it, so the replacement has to keep it rather than lose it with the block it sits in.
	it("keeps the load-slot sentence the terms run on from", () => {
		const withLead = `<p>◇ or ◇◇ : it takes up one of these slots. <strong><em>area</em></strong>: a. <strong><em>crude</em></strong>: b.</p>`;
		const html = replaceGlossary(withLead, entries);
		expect(html).toContain("<p>◇ or ◇◇ : it takes up one of these slots.</p>");
	});

	// The run continues into the next column, which arrives as a second paragraph of the same list.
	it("folds a run continued in another column into the one list", () => {
		const html = replaceGlossary(`${run}${run}`, entries);
		expect((html.match(/<dl/g) ?? []).length).toBe(1);
	});

	it("leaves ordinary prose alone", () => {
		const prose = "<p>Many items appear with a list of terms after their name.</p>";
		expect(replaceGlossary(prose, entries)).toBe(prose);
	});
});
