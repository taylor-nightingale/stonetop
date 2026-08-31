import { describe, it, expect } from "vitest";
import { itemDescriptionRich } from "../../src/item/itemDescriptionRich.js";
import { moveSheetRichText } from "../../src/item/StonetopMoveSheet.js";
import { renderTemplate } from "../fakes/renderTemplate.js";

/**
 * The bug: a description stored as markdown, handed to a <prose-mirror>.
 *
 * The editor parses its `value` as HTML, where newlines are insignificant, so the whole description
 * arrives as ONE text run — you open the sheet and see `- A week or so: 1` as literal text in a
 * single paragraph — and on blur it serializes what it parsed and saves that back. One <p>, every
 * line break and list marker welded in, and the move's own text destroyed without anyone typing.
 * That is what happened to Bolster.
 *
 * The fix is the seed: convert before the editor sees it, so the editor is handed the paragraphs and
 * lists the markdown described. Idempotent, so a description the editor has already saved is passed
 * through and cannot be re-wrapped.
 *
 * The choice-group editor has always done this (`content.textHtml`), which is why choice rows never
 * broke while move descriptions did.
 */
const BOLSTER = [
	"When you **_prepare for what's coming_**, say how. Then hold Preparation:",
	"",
	"- A week or so: 1 Preparation",
	"- A month or so: 2 Preparation",
].join("\n");

describe("the description a <prose-mirror> is seeded with", () => {
	it("arrives as paragraphs and a real list, not as markdown", () => {
		const { descriptionHtml } = itemDescriptionRich({ description: BOLSTER });

		expect(descriptionHtml).toContain("<ul><li>A week or so: 1 Preparation</li>");
		expect(descriptionHtml).toContain("<strong><em>prepare for what's coming</em></strong>");
		expect(descriptionHtml, "markdown reached the editor").not.toContain("**");
		expect(descriptionHtml, "markdown reached the editor").not.toMatch(/^- /m);
	});

	// A list inside a paragraph is markup no parser accepts: the browser closes the <p> before the
	// <ul> and ProseMirror drops the structure on its next save — the same data loss by another route.
	it("never wraps the list in a paragraph", () => {
		expect(itemDescriptionRich({ description: BOLSTER }).descriptionHtml).not.toMatch(/<p>\s*<ul/);
	});

	// What makes the seed safe to apply on every render: the second pass is what a re-opened sheet
	// does, and it must not wrap the editor's own output again.
	it("passes a description the editor has already saved through untouched", () => {
		const saved = "<p>Already edited.</p><ul><li>and a list</li></ul>";
		expect(itemDescriptionRich({ description: saved }).descriptionHtml).toBe(saved);
	});

	it("still gives the read-only branch a RichText of the stored text", () => {
		const { description } = itemDescriptionRich({ description: BOLSTER });
		expect(description.raw).toBe(BOLSTER);
	});

	it.each([[null], [undefined], [""]])("survives a missing description (%s)", value => {
		expect(itemDescriptionRich({ description: value }).descriptionHtml).toBe("");
	});

	// The move sheet builds its own context (it has the result tiers too), so it needs its own seed —
	// this is the sheet the bug was actually reported on.
	it("is built by the move sheet too, leaving its result tiers as markdown", () => {
		const context = moveSheetRichText({
			description: BOLSTER,
			moveResults: { success: { value: "Pick **two**:\n\n- a\n- b" } },
		});

		expect(context.descriptionHtml).toContain("<ul><li>A week or so: 1 Preparation</li>");
		// The tiers are edited in a plain <textarea>, so they stay markdown — converting them would
		// put HTML in the box somebody types into.
		expect(context.success.raw).toBe("Pick **two**:\n\n- a\n- b");
	});
});

describe("the four item sheets that carry a description editor", () => {
	const SHEETS = [
		["move",       "systems/stonetop/templates/item/move.hbs"],
		["playbook",   "systems/stonetop/templates/item/playbook.hbs"],
		["possession", "systems/stonetop/templates/item/possession.hbs"],
		["insert",     "systems/stonetop/templates/item/insert.hbs"],
	];

	// Rendered from the real templates: the defect was that the editor's `value` came straight from
	// `system.description`, and only the markup says which one it reads.
	it.each(SHEETS)("seeds %s's editor from the converted html", (_name, template) => {
		const html = renderTemplate(template, {
			editable: true,
			item: { name: "X", img: "" },
			system: { description: BOLSTER, moveResults: {}, choices: null },
			rich: itemDescriptionRich({ description: BOLSTER }),
			tabs: { basics: { cssClass: "active" } },
		});

		const value = /<prose-mirror[^>]*name="system\.description"[^>]*value="([^"]*)"/.exec(html)?.[1];
		expect(value, "no description editor rendered").toBeDefined();
		expect(value, "the editor is still seeded with raw markdown").not.toContain("**");
		expect(value).toContain("&lt;ul&gt;");
	});
});
