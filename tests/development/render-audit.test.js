import { describe, it, expect } from "vitest";
import { plainText, normalise, squeeze, authoredStrings }
	from "../../scripts/development/render-surface.mjs";

/**
 * The audit's comparison rules.
 *
 * Everything the render audit claims rests on these three functions: if they are wrong it either
 * reports content as dropped that is on the page, or misses content that is not. Both happened
 * while they were being written — 316 false positives at the first attempt, 44 at the third — so
 * the cases that caused them are written down here rather than left as folklore.
 */
describe("plainText", () => {
	it("keeps the text between tags", () => {
		expect(plainText("<p>hello <em>there</em></p>")).toContain("hello");
		expect(plainText("<p>hello <em>there</em></p>")).toContain("there");
	});

	it("decodes the entities the templates emit", () => {
		expect(plainText("<p>salt &amp; iron</p>")).toContain("salt & iron");
	});

	// A placeholder and an aria-label are text a reader or their screen reader receives, so a field
	// that carries one has rendered it. Counting only the first attribute on an element reported
	// every placeholder as missing, because aria-label comes first in the markup.
	it("counts every text-bearing attribute on an element, not the first", () => {
		const html = '<textarea aria-label="choice text" placeholder="level checked"></textarea>';
		expect(plainText(html)).toContain("choice text");
		expect(plainText(html)).toContain("level checked");
	});
});

describe("normalise", () => {
	it("strips markdown emphasis", () => {
		expect(normalise("**LONGING** — *name* them")).toBe("LONGING — name them");
	});

	it("strips inline roll expressions", () => {
		expect(normalise("bronze knife [[/r 1d4]] (hand)")).toBe("bronze knife (hand)");
	});

	it("strips list and pip markers at the start of a line", () => {
		expect(normalise("- Speak with birds")).toBe("Speak with birds");
		expect(normalise("◇ whips")).toBe("whips");
	});
});

describe("squeeze", () => {
	// Rendering inserts a space at every tag boundary, so <em>e</em>ither comes back as "e ither".
	// One real move (Call Forth and Command) failed the audit for exactly this and nothing else.
	it("ignores spacing introduced by tag boundaries", () => {
		expect(squeeze(plainText("When <em>e</em>ither is banished")))
			.toContain(squeeze("When either is banished"));
	});

	it("ignores how a bullet list flattens", () => {
		expect(squeeze(plainText("<ul><li>useful</li><li>either way</li></ul>")))
			.toContain(squeeze("- useful\n- either way"));
	});

	it("is case-insensitive", () => {
		expect(squeeze("Sacred Pouch")).toBe(squeeze("sacred pouch"));
	});

	it("still fails when a word is genuinely absent", () => {
		expect(squeeze(plainText("<p>Name the person</p>"))).not.toContain(squeeze("Name the place"));
	});
});

describe("authoredStrings", () => {
	it("flattens nested values and drops blanks", () => {
		expect(authoredStrings({ a: "one", b: ["two", "", null], c: { d: "three" } }))
			.toEqual(["one", "two", "three"]);
	});
});
