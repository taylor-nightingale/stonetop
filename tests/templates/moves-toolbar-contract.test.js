import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// The "Selected only" filter is positioned out of flow so it lands on the first move group's
// heading line; in flow it took a row of its own and sat in an empty band above the heading.
// That costs two invisible dependencies: a positioned ancestor to pin against, and the toolbar
// being the first group's immediate previous sibling (the rule that stops a long group note from
// running under the button). Either one breaks silently — the tab still renders, it just looks
// wrong. These pin them.

const read = rel => readFileSync(path.resolve(process.cwd(), rel), "utf8");
const css = read("styles/stonetop.css");
const template = read("templates/actor/partials/tab-moves.hbs");

const ruleBlock = selector => {
	const at = css.indexOf(`${selector} {`);
	return at < 0 ? null : css.slice(at, css.indexOf("}", at));
};

describe("moves filter toolbar contract", () => {
	it("takes the toolbar out of flow", () => {
		expect(ruleBlock(".stonetop-moves-toolbar")).toContain("position: absolute");
	});

	// Without this the button pins against whatever ancestor happens to be positioned — in
	// practice the sheet window, which parks it in the wrong corner entirely.
	it("gives it a positioned ancestor to pin against", () => {
		expect(ruleBlock(".tab.moves .sheet-tab")).toContain("position: relative");
	});

	// The heading is a bare text line, shorter than the button. Both sides read one declared height
	// so the heading can't come up short and let the button hang over the divider beneath it.
	it("reserves the button's own width and height on the heading it overlays", () => {
		const block = ruleBlock(".stonetop-moves-toolbar + .stonetop-move-group .stonetop-move-group-title");
		expect(block).toContain("padding-right");
		expect(block).toContain("min-height: var(--moves-filter-height)");
		expect(ruleBlock("button.stonetop-moves-filter")).toContain("height: var(--moves-filter-height)");
	});

	it("declares that height on an ancestor of both", () => {
		expect(ruleBlock(".tab.moves .sheet-tab")).toContain("--moves-filter-height:");
	});

	// The reservation rule is an adjacent-sibling selector, so nothing may render between the
	// toolbar and the first group.
	it("emits the toolbar as the first group's immediate previous sibling", () => {
		const toolbarAt = template.indexOf("stonetop-moves-toolbar");
		const groupAt   = template.indexOf('{{> "stonetop.move-group"');
		expect(toolbarAt).toBeGreaterThan(-1);
		expect(groupAt).toBeGreaterThan(toolbarAt);

		const toolbarClose = template.lastIndexOf("</div>", groupAt);
		expect(toolbarClose).toBeGreaterThan(toolbarAt);
		expect(template.slice(toolbarClose + "</div>".length, groupAt)).not.toContain("<");
	});

	// ...and the sibling the selector names has to be what that partial actually emits.
	it("renders each group behind the class the selector matches", () => {
		expect(read("templates/actor/partials/move-group.hbs").trimStart())
			.toMatch(/^<div class="stonetop-move-group">/);
	});
});
