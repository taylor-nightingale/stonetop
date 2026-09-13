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

	it("puts the tick where the checkbox was, in every shape", () => {
		expect(condensed.match(/stonetop-choice-tick/g).length).toBe(3);
	});
});

describe("tab toolbar contract", () => {
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
		expect(block).toContain("min-height: var(--view-toggle-height)");
	});

	// One height for every toggle — declared once, on the button they all share. Per-tab heights are
	// what let the insert lock render at a size of its own.
	it("sizes every toggle from the one token", () => {
		expect(ruleBlock(":root")).toContain("--view-toggle-height:");
		expect(ruleBlock("button.stonetop-view-toggle")).toContain("height: var(--view-toggle-height)");
		expect(css.match(/--view-toggle-height:\s/g)).toHaveLength(1);
	});

	// Every tab's toggle is one button, one action and one appearance; a tab only adds what is its
	// own (the moves filter, the height it reserves on the heading it overlays).
	it("renders every toggle through the shared partial and action", () => {
		const toggle = read("templates/actor/partials/tab-toolbar-toggle.hbs");
		expect(toggle).toContain('data-action="toggleTabView"');
		expect(toggle).toContain('data-view-flag="{{flag}}"');
		for (const tab of ["tab-moves", "tab-playbook", "tab-insert"])
			expect(read(`templates/actor/partials/${tab}.hbs`)).toContain('{{> "stonetop.tab-toolbar-toggle"');
	});

	// One vocabulary across the three tabs: every toggle reads Lock / Edit from the shared keys, so
	// a tab cannot drift into wording of its own.
	it("labels every toggle from the one pair of keys", () => {
		for (const tab of ["tab-moves", "tab-playbook", "tab-insert"]) {
			const source = read(`templates/actor/partials/${tab}.hbs`);
			expect(source).toContain('localize "stonetop.sheet.lock.lock"');
			expect(source).toContain('localize "stonetop.sheet.lock.unlock"');
			expect(source).toContain('icon="fa-lock"');
			expect(source).toContain('icon="fa-lock-open"');
		}
	});

	// The one behavioural difference rides on the button: a filter that only hides rows names the
	// class the sheet drops on the live tab, and so never rebuilds it (see TabViewFlags).
	// The insert lock and the delete icon are peers in one flow row; pinning either absolutely is
	// how the lock ended up underneath the trash icon.
	it("keeps the insert tab's controls in one row rather than stacked on each other", () => {
		expect(read("templates/actor/partials/tab-insert.hbs")).toContain(`class="stonetop-insert-actions"`);
		expect(ruleBlocks(".stonetop-insert-actions").join()).toContain("display: flex");
		expect(ruleBlock(".stonetop-insert-remove")).not.toContain("position: absolute");
	});

	// A shut rail folds to a strip down the tab's edge — at a narrow width, where the rail is a
	// drawer over the tab, and at any width where the reader has put the rail away. The strip is
	// positioned, so the tab runs clean underneath it unless something steps aside.
	//
	// The REGION steps aside, once, rather than the two or three controls that used to share a corner
	// with a 26px button: a strip is against every line of the tab, not just the top one, and paying
	// per control cost the Play tab the first characters of every row in it.
	//
	// A MARGIN, because on the character sheet that region is the scrolling box itself — padding
	// moved its content and left its border box, and so its scrollbar, under the strip. The geometry
	// that proves it is in tests/styles/rail-drawer.test.js; this only pins which property is used.
	it("steps the whole tab aside for the folded rail, on both sides", () => {
		for (const side of ["left", "right"]) {
			const rule = `.stonetop-rail-layout[data-side="${side}"] > .stonetop-rail-main { margin-${side === "left" ? "left" : "right"}: var(--rail-toggle-gutter); }`;
			expect(css, `a ${side}-hand rail's tab does not step aside for the strip`).toContain(rule);
		}

		// And no control pays it a second time: doubled, the gutter is a ragged edge where one tab
		// indents twice as far as the one beside it.
		for (const selector of [".stonetop-moves-toolbar", ".stonetop-playbook-toolbar", ".stonetop-insert-actions"]) {
			const at = css.indexOf(`.stonetop-rail-layout[data-side="right"] ${selector}`);
			expect(at, `${selector} spends the gutter the region already spent`).toBe(-1);
		}

		// Set where the region can read it, in both states that fold the rail — and set FROM the
		// strip's own width, so widening the strip cannot leave the tab underneath it.
		const gutter = "--rail-toggle-gutter: calc(var(--rail-strip) + 6px)";
		const narrow = css.slice(css.indexOf("@container (max-width: 900px)"));
		expect(narrow).toContain(gutter);
		expect(css).toContain(`.rail-shut > .stonetop-rail-main { ${gutter}; }`);
	});

	it("marks the moves filter as the toggle that decorates rather than re-renders", () => {
		expect(template).toContain('viewClass="hide-unselected"');
		expect(read("templates/actor/partials/tab-playbook.hbs")).not.toContain("viewClass=");
		expect(read("templates/actor/partials/tab-insert.hbs")).not.toContain("viewClass=");
	});

	// Core's .window-app rule stretches a bare button to full width, and a non-editable sheet
	// disables every button that is not marked as view state — both would break the toggle silently.
	it("styles the shared toggle against core's button rules, and keeps it live when read-only", () => {
		expect(ruleBlock("button.stonetop-view-toggle")).toContain("width: auto");
		expect(read("templates/actor/partials/tab-toolbar-toggle.hbs")).toContain("data-view-state");
	});

	// The playbook lock rides the title image's line the same way the filter rides its heading:
	// out of flow, against a positioned ancestor, with the block beneath reserving its space.
	it("pins the playbook lock over the tab's intro rather than giving it a row", () => {
		expect(ruleBlock(".stonetop-playbook-toolbar")).toContain("position: absolute");
		expect(ruleBlock(".tab.playbook .sheet-tab")).toContain("position: relative");

		const reserved = ruleBlock(".stonetop-playbook-toolbar + .stonetop-playbook-intro");
		expect(reserved).toContain("min-height: var(--view-toggle-height)");
		expect(reserved).toContain("padding-right");
	});

	// That reservation is an adjacent-sibling rule, so the toolbar has to stay the intro's
	// immediate previous sibling.
	it("emits the playbook toolbar immediately before the intro it overlays", () => {
		const playbook = read("templates/actor/partials/tab-playbook.hbs");
		const toolbarAt = playbook.indexOf("stonetop-playbook-toolbar");
		const introAt   = playbook.indexOf("stonetop-playbook-intro");
		expect(toolbarAt).toBeGreaterThan(-1);
		expect(introAt).toBeGreaterThan(toolbarAt);

		const toolbarCloses = playbook.lastIndexOf("</div>", introAt) + "</div>".length;
		const introOpens    = playbook.lastIndexOf("<div", introAt);
		expect(playbook.slice(toolbarCloses, introOpens)).not.toContain("<");
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

	// ...and the sibling the selector names has to be what that partial actually emits. A leading
	// Handlebars comment emits nothing, so it is stripped first — the contract is about output.
	it("renders each group behind the class the selector matches", () => {
		const emitted = read("templates/actor/partials/move-group.hbs").replace(/^\s*\{\{!--.*?--\}\}/s, "").trimStart();
		expect(emitted).toMatch(/^<div class="stonetop-move-group">/);
	});
});
