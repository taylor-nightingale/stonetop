import { describe, it, expect } from "vitest";
import { artifactUuid, extractBlocks, htmlToMarkdown, linkArtifacts } from "../../scripts/import/build-artifacts.js";
import { deterministicId } from "../../scripts/import/ids.js";

const ARTICLE = `
<div class="page2col"><div class="col"><hr class="rule">
<h3><img class="icon" src="systems/stonetop/assets/content/wonders/markers/marker-vessel.png">The Three-star Crown</h3>
<p class="artifact-tags"><em>magical</em>, <em>beautiful</em>, Value 4</p>
<p>A circlet of whitest gold.</p>
<p>When you <strong><em>wear the crown</em></strong>, roll +WIS: <strong>on a 10+</strong>, tell the GM a hope.</p></div></div>
<div class="page2col"><div class="col">
<h3>Hearth spirit</h3>
<p class="artifact-tags">Solitary, spirit, friendly, nurturing</p>
<p>A small god of the home.</p>
<h3>A lead bracelet</h3>
<p class="artifact-tags"><em>magical</em>, Value 1</p>
<p>A heavy, black metal torc.</p>
<ul><li>First</li><li>Second</li></ul>
<h2>Dangers</h2>
<p>Section prose that is not part of any artifact.</p></div></div>
`;

describe("extractBlocks", () => {
	const blocks = extractBlocks(ARTICLE);

	it("finds every tag-line block, including NPC-shaped ones", () => {
		expect(blocks.map((b) => b.name)).toEqual(["The Three-star Crown", "Hearth spirit", "A lead bracelet"]);
	});

	it("converts tag lines to markdown", () => {
		expect(blocks[0].tags).toBe("*magical*, *beautiful*, Value 4");
		expect(blocks[1].tags).toBe("Solitary, spirit, friendly, nurturing");
	});

	it("stops each body at the next heading of any level", () => {
		expect(blocks[0].body).toContain("circlet of whitest gold");
		expect(blocks[0].body).not.toContain("small god");
		expect(blocks[2].body).not.toContain("Section prose");
	});

	it("renders move text as bold-italic markdown", () => {
		expect(blocks[0].body).toContain("When you **_wear the crown_**, roll +WIS: **on a 10+**");
	});

	it("renders list items as markdown bullets", () => {
		expect(blocks[2].body).toContain("- First");
		expect(blocks[2].body).toContain("- Second");
	});

	it("unwraps a cross-linked heading to its bare label", () => {
		const linked = extractBlocks(
			'<h3>@UUID[Compendium.stonetop.possessions.Item.abc]{A lead bracelet}</h3>' +
			'<p class="artifact-tags"><em>magical</em>, Value 1</p><p>A heavy torc.</p>');
		expect(linked[0].name).toBe("A lead bracelet");
	});

	it("keeps the ◇ weight pips in the tag line", () => {
		const piped = extractBlocks(
			'<h3>A pot of “gold”</h3>' +
			'<p class="artifact-tags">◇◇, <em>magical</em></p><p>A small bronze cauldron.</p>');
		expect(piped[0].tags).toBe("◇◇, *magical*");
	});

	it("drops the book's tracking checkbox from tag lines", () => {
		const boxed = extractBlocks(
			'<h3>The Three-star Crown</h3>' +
			'<p class="artifact-tags">□ <em>magical</em>, <em>beautiful</em>, Value 4</p><p>A circlet.</p>');
		expect(boxed[0].tags).toBe("*magical*, *beautiful*, Value 4");
	});
});

describe("artifactUuid", () => {
	it("addresses the possession item by its deterministic artifact id", () => {
		expect(artifactUuid("the-three-star-crown"))
			.toBe(`Compendium.stonetop.possessions.Item.${deterministicId("possessions", "artifact:the-three-star-crown")}`);
	});
});

describe("linkArtifacts", () => {
	const { html, linked } = linkArtifacts(ARTICLE);

	it("wraps each artifact title in a @UUID link to its possession item, keeping the marker icon outside", () => {
		expect(linked).toBe(2);
		expect(html).toContain(
			`<img class="icon" src="systems/stonetop/assets/content/wonders/markers/marker-vessel.png">@UUID[${artifactUuid("the-three-star-crown")}]{The Three-star Crown}</h3>`);
		expect(html).toContain(`@UUID[${artifactUuid("a-lead-bracelet")}]{A lead bracelet}</h3>`);
	});

	it("leaves NPC-shaped blocks (spirits/followers) plain", () => {
		expect(html).toContain("<h3>Hearth spirit</h3>");
	});

	it("leaves tag lines and bodies untouched", () => {
		expect(html).toContain('<p class="artifact-tags"><em>magical</em>, <em>beautiful</em>, Value 4</p>');
		expect(html).toContain("<p>A circlet of whitest gold.</p>");
	});

	it("is idempotent", () => {
		const again = linkArtifacts(html);
		expect(again.linked).toBe(0);
		expect(again.html).toBe(html);
	});

	it("round-trips: extractBlocks reads the same names out of the linked HTML", () => {
		expect(extractBlocks(html).map((b) => b.name)).toEqual(extractBlocks(ARTICLE).map((b) => b.name));
	});
});

describe("htmlToMarkdown", () => {
	it("strips images, rules, and column wrappers", () => {
		expect(htmlToMarkdown('<div class="col"><hr class="rule"><p>Text <img src="stonetop-art/wonders/abc.png">here.</p></div>'))
			.toBe("Text here.");
	});

	it("joins table cells with em-dashes and rows as bullets", () => {
		expect(htmlToMarkdown("<table><tr><td>1</td><td>An old scroll case</td></tr><tr><td>2</td><td>A tattered mantle</td></tr></table>"))
			.toBe("- 1 — An old scroll case\n- 2 — A tattered mantle");
	});

	it("keeps @UUID references intact", () => {
		const s = "<p>See @UUID[Compendium.stonetop.wider-world-and-other-wonders.JournalEntry.abc]{Fae}.</p>";
		expect(htmlToMarkdown(s)).toContain("@UUID[Compendium.stonetop.wider-world-and-other-wonders.JournalEntry.abc]{Fae}");
	});
});
