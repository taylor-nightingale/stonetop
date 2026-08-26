import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

/**
 * `data-action="tab"` is core ApplicationV2's built-in changeTab action, and every tab nav in the
 * system is a <button>. That matters twice over:
 *
 *   • core binds the action's click handler to buttons — a nav built from anchors or spans is
 *     keyboard-dead (see the data-action-needs-a-button rule);
 *   • a <button> inside a sheet form gets `disabled` when the sheet is non-editable, which is how a
 *     locked compendium playbook ended up with a tab bar nobody could click. reenableViewStateControls
 *     un-disables `[data-action="tab"]`, and that selector only reaches the buttons.
 *
 * changeTab also reads the group and target off the element, so both data attributes are required.
 */

function templateFiles(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return templateFiles(full);
		return entry.name.endsWith(".hbs") ? [full] : [];
	});
}

// Every element in the source that carries data-action="tab", as `{ tag, attrs }`.
function tabControls(source) {
	return [...source.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*\bdata-action="tab"[^>]*)>/g)]
		.map(m => ({ tag: m[1].toLowerCase(), attrs: m[2] }));
}

function allTabControls() {
	return templateFiles(path.resolve(process.cwd(), "templates"))
		.flatMap(file => tabControls(readFileSync(file, "utf8"))
			.map(control => ({ ...control, file: path.relative(process.cwd(), file) })));
}

describe("tab navigation markup", () => {
	it("exists — these assertions are worthless if the scan finds nothing", () => {
		expect(allTabControls().length).toBeGreaterThan(0);
	});

	it("is always a <button>, never an anchor or a span", () => {
		const offenders = allTabControls()
			.filter(control => control.tag !== "button")
			.map(control => `${control.file}: <${control.tag}>`);

		expect(offenders).toEqual([]);
	});

	it("always names its group and its target tab", () => {
		const offenders = allTabControls()
			.filter(control => !/\bdata-group=/.test(control.attrs) || !/\bdata-tab=/.test(control.attrs))
			.map(control => `${control.file}: ${control.attrs.trim()}`);

		expect(offenders).toEqual([]);
	});
});
