import { describe, it, expect } from "vitest";
import { markdownBlocks, startsBlock, joinBlocks } from "../../src/utils/markdownBlocks.js";

const render = md => joinBlocks(markdownBlocks(md));

describe("markdownBlocks", () => {
	it("returns one entry per blank-line-separated block", () => {
		expect(markdownBlocks("First.\n\nSecond.")).toEqual(["First.", "Second."]);
	});

	it("keeps an authored line break inside a block", () => {
		expect(markdownBlocks("Line one\nLine two")).toEqual(["Line one<br />Line two"]);
	});

	it("drops blank and whitespace-only blocks", () => {
		expect(markdownBlocks("First.\n\n   \n\nSecond.")).toEqual(["First.", "Second."]);
		expect(markdownBlocks("")).toEqual([]);
		expect(markdownBlocks(null)).toEqual([]);
	});

	it("renders a list without gluing a break to its markup", () => {
		expect(markdownBlocks("- one\n- two")).toEqual(["<ul><li>one</li><li>two</li></ul>"]);
	});

	it("renders markdown emphasis", () => {
		expect(markdownBlocks("A **bold** claim")).toEqual(["A <strong>bold</strong> claim"]);
	});

	it("leaves the newlines inside a code block alone", () => {
		expect(markdownBlocks("```\nfirst\nsecond\n```"))
			.toEqual(['<pre class="code "><code>first\nsecond</code></pre>']);
	});

	it("keeps a fill-in-the-blank out of the emphasis pass", () => {
		expect(markdownBlocks("\u25c7\u25c7 A shield, bearing ___\u2019s crest"))
			.toEqual(["\u25c7\u25c7 A shield, bearing ___\u2019s crest"]);
		expect(markdownBlocks("How is ________ weak or vulnerable?"))
			.toEqual(["How is ________ weak or vulnerable?"]);
		expect(markdownBlocks("Can I trust them (to _____)?"))
			.toEqual(["Can I trust them (to _____)?"]);
	});

	it("keeps two blanks in one line as two blanks, not a bold run between them", () => {
		expect(markdownBlocks("__\u2019s kid/sibling/parent/cousin/__"))
			.toEqual(["__\u2019s kid/sibling/parent/cousin/__"]);
	});

	it("still renders emphasis around a blank", () => {
		expect(markdownBlocks("When you **_Seek Insight_**, how is ___ weak?"))
			.toEqual(["When you <strong><em>Seek Insight</em></strong>, how is ___ weak?"]);
		expect(markdownBlocks("a _close_ blank ___ here"))
			.toEqual(["a <em>close</em> blank ___ here"]);
	});

	it("leaves a blank inside a code block alone", () => {
		expect(markdownBlocks("```\nname ___ here\n```"))
			.toEqual(['<pre class="code "><code>name ___ here</code></pre>']);
	});

	it("leaves a shielded sentinel untouched", () => {
		expect(markdownBlocks("see \uf8ff0\uf8ff now\nand again"))
			.toEqual(["see \uf8ff0\uf8ff now<br />and again"]);
	});
});

describe("startsBlock", () => {
	it("is true for HTML opening with a block-level element", () => {
		expect(startsBlock("<ul><li>one</li></ul>")).toBe(true);
		expect(startsBlock("<h2>Title</h2>")).toBe(true);
	});

	it("is false for inline HTML", () => {
		expect(startsBlock("A <strong>bold</strong> claim")).toBe(false);
		expect(startsBlock("<strong>bold</strong> first")).toBe(false);
	});
});

describe("joinBlocks", () => {
	it("puts a blank line between two runs of prose", () => {
		expect(joinBlocks(["First.", "Second."])).toBe("First.<br /><br />Second.");
	});

	it("adds no break where a block-level element already ends the line", () => {
		expect(joinBlocks(["<ul><li>one</li></ul>", "After."])).toBe("<ul><li>one</li></ul>After.");
		expect(joinBlocks(["Before.", "<ul><li>one</li></ul>"])).toBe("Before.<ul><li>one</li></ul>");
	});

	it("returns an empty string for no blocks", () => {
		expect(joinBlocks([])).toBe("");
	});
});

describe("markdownBlocks + joinBlocks (what the display shows)", () => {
	it("shows every line the editor shows", () => {
		expect(render("asdf\na\na\naa")).toBe("asdf<br />a<br />a<br />aa");
	});

	it("shows a blank line as a blank line", () => {
		expect(render("Roll...\n\n... +1 if you have their scent;\n... +1 if alone."))
			.toBe("Roll...<br /><br />... +1 if you have their scent;<br />... +1 if alone.");
	});

	it("keeps prose after a list on its own lines", () => {
		expect(render("- Bite\n- Claw\n\nBig cattle.\nWith horns."))
			.toBe("<ul><li>Bite</li><li>Claw</li></ul>Big cattle.<br />With horns.");
	});
});
