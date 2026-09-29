import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// Markup and CSS contracts between the character's tabs that no render asserts on: shapes two
// partials must share, controls that must sit in one row, and a gutter paid once.

const read = rel => readFileSync(path.resolve(process.cwd(), rel), "utf8");
const css = read("styles/stonetop.css");

const ruleBlock = selector => {
	const at = css.indexOf(`${selector} {`);
	return at < 0 ? null : css.slice(at, css.indexOf("}", at));
};

// A selector styled in more than one place (a base rule plus a narrow-layout override) — the tests
// below say which of the blocks has to carry what.
const ruleBlocks = selector => {
	const blocks = [];
	for (let at = css.indexOf(`${selector} {`); at >= 0; at = css.indexOf(`${selector} {`, at + 1))
		blocks.push(css.slice(at, css.indexOf("}", at)));
	return blocks;
};

// Locking a tab must not restyle it: a condensed line is emitted in the same shape — the same
// classes, the same partial — the editor gave that row, with the tick standing where the checkbox
// stood. Drift here is invisible to every other test, which asserts on text rather than markup.
describe("condensed choice group keeps the editor's shapes", () => {
	const condensed = read("templates/actor/partials/choice-group-condensed.hbs");
	const choiceRow = read("templates/actor/partials/choice-row.hbs");

	it("renders a named entry through the same sub-heading partial as the editor", () => {
		expect(choiceRow).toContain('{{> "stonetop.section-sub-heading"');
		expect(condensed).toContain('{{> "stonetop.section-sub-heading"');
		expect(condensed).toContain(`<div class="stonetop-choice-track stonetop-column">`);
		expect(condensed).toContain(`class="stonetop-choice-header-wrapper"`);
	});

	it("renders a described pick as the editor's card", () => {
		expect(condensed).toContain(`class="stonetop-item is-checked"`);
		expect(condensed).toContain(`class="stonetop-item-name"`);
		expect(condensed).toContain(`class="stonetop-item-description"`);
	});

	// The plain line is the shared ticked line (ticked-line.hbs), which every resting section uses.
	it("puts the tick where the checkbox was, in every shape", () => {
		// The named entry's, the card's and the answered blank's; the plain line's is in ticked-line.hbs.
		expect(condensed.match(/stonetop-choice-tick/g).length).toBe(3);
		expect(condensed).toContain('{{> "stonetop.ticked-line"');
		expect(read("templates/actor/partials/ticked-line.hbs")).toContain("stonetop-choice-tick");
	});
});

describe("tab toolbar contract", () => {
	// One height for the labelled toggle (the advice button spelled out), declared once.
	it("sizes the labelled toggle from the one token", () => {
		expect(ruleBlock(":root")).toContain("--view-toggle-height:");
		expect(ruleBlock("button.stonetop-view-toggle")).toContain("height: var(--view-toggle-height)");
		expect(css.match(/--view-toggle-height:\s/g)).toHaveLength(1);
	});

	// Each section and panel is its own door (D11, D12): no tab has a lock or a "selected only" filter.
	it("gives no tab a lock or a filter", () => {
		for (const tab of ["tab-playbook", "tab-insert", "tab-moves", "tab-possessions"]) {
			const source = read(`templates/actor/partials/${tab}.hbs`);
			expect(source).not.toContain("tab-toolbar-toggle");
			expect(source).not.toContain("data-view-flag");
		}
	});

	// The insert's controls sit in one flow row at the head's right; pinning one absolutely is how a
	// control once ended up underneath the trash icon.
	it("keeps the insert tab's controls in one row rather than stacked on each other", () => {
		expect(read("templates/actor/partials/tab-insert.hbs")).toContain(`class="stonetop-insert-actions"`);
		expect(ruleBlocks(".stonetop-insert-actions").join()).toContain("display: flex");
		expect(ruleBlock(".stonetop-insert-remove")).not.toContain("position: absolute");
	});

	// Core's .window-app rule stretches a bare button to full width.
	it("styles the labelled toggle against core's button rules", () => {
		expect(ruleBlock("button.stonetop-view-toggle")).toContain("width: auto");
	});
});
