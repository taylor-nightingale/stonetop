// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { renderPartial } from "../fakes/renderTemplate.js";

// The column of radios the improvement sheet's editors draw their one-of-N choices with. The roll
// modes themselves are no longer a radio group on any sheet: every roll asks for them (RollModeDialog).

const root = process.cwd();
const read = rel => readFileSync(path.resolve(root, rel), "utf8");

const dom = html => { const el = document.createElement("div"); el.innerHTML = html; return el; };

const options = selected => ["each", "some", "or"].map(key =>
	({ key, labelKey: `stonetop.improvement.rule.${key}`, checked: key === selected, hasDetail: false }));

const picker = (selected, params = {}) =>
	renderPartial("stonetop.roll-mode-picker", { modes: options(selected), ...params });

describe("roll-mode picker partial", () => {
	it("renders one radio per option", () => {
		const html = picker("each");
		for (const key of ["each", "some", "or"]) expect(html).toContain(`value="${key}"`);
	});

	it("checks only the selected option", () => {
		const html = picker("or");
		expect(html).toMatch(/value="or"\s+checked/);
		expect(html).not.toMatch(/value="each"\s+checked/);
		expect(html).not.toMatch(/value="some"\s+checked/);
	});

	// The label carries the checked state as a class as well as the input carrying the attribute: the
	// circle mark is drawn off both.
	it("marks the selected option's label", () => {
		expect(picker("some")).toContain('class="stonetop-rollmode-option is-checked"');
	});

	it("scopes the radio group to the name its caller passes", () => {
		expect(picker("each", { name: "rule-1" })).toContain('name="rule-1"');
	});

	it("emits the change-router hook only when given one", () => {
		expect(picker("each", { changeAction: "sectionRule" })).toContain('data-change-action="sectionRule"');
		expect(picker("each")).not.toContain("data-change-action");
	});

	it("gives every radio a label to be named by", () => {
		expect(dom(picker("each")).querySelectorAll(".stonetop-rollmode-option .stonetop-rollmode-label")).toHaveLength(3);
	});

	// Radios that mean one setting are a group; a group with no accessible name is loose words.
	it("wraps the options in a named group", () => {
		const doc = dom(picker("each", { legendKey: "stonetop.improvement.rule.lead" }));
		expect(doc.querySelector("fieldset.stonetop-rollmode legend").textContent).toBe("stonetop.improvement.rule.lead");
	});
});

describe("roll-mode picker call sites", () => {
	// The mode is asked for on every roll; a sheet that kept one too would be two answers to one question.
	it("is drawn on neither sheet's header", () => {
		for (const file of ["templates/actor/character.hbs", "templates/actor/partials/character-band.hbs",
			"templates/actor/partials/character-masthead.hbs", "templates/actor/partials/folded-ledger.hbs",
			"templates/actor/steading.hbs"]) {
			expect(read(file), `${file} renders a roll-mode picker`).not.toContain("roll-mode-picker");
		}
	});

	it("has no template hand-building its radios", () => {
		const hbs = [];
		const walk = dir => {
			for (const e of readdirSync(path.join(root, dir), { withFileTypes: true })) {
				const rel = path.join(dir, e.name);
				if (e.isDirectory()) walk(rel);
				else if (e.name.endsWith(".hbs")) hbs.push(rel);
			}
		};
		walk("templates");
		const others = hbs.filter(f => !f.endsWith("roll-mode-picker.hbs") && read(f).includes("stonetop-rollmode-input"));
		expect(others).toEqual([]);
	});
});
