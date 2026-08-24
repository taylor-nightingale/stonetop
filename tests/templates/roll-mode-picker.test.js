import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { renderPartial } from "../fakes/renderTemplate.js";
import { RollModes } from "../../src/actors/RollModes.js";

// The roll-mode radios existed three times: the character sheet's move side-bar, the stat-pick
// dialog (built as a JS string), and the steading sheet. The first two are byte-identical markup and
// had already drifted — the JS copy omitted `is-checked` and the <span> around the label — so they
// render from one partial now. The steading's is a genuinely different control (its box glyph, and a
// different mode order) and is deliberately left out; a test below pins that as a choice rather than
// letting it read as one more copy someone forgot.

const root = process.cwd();
const read = rel => readFileSync(path.resolve(root, rel), "utf8");

const picker = (selected, params = {}) =>
	renderPartial("stonetop.roll-mode-picker", { modes: RollModes.options(selected), ...params });

describe("roll-mode picker partial", () => {
	it("renders one radio per mode", () => {
		const html = picker("normal");
		for (const key of ["adv", "normal", "dis"]) expect(html).toContain(`value="${key}"`);
	});

	it("checks only the selected mode", () => {
		const html = picker("dis");
		expect(html).toMatch(/value="dis"\s+checked/);
		expect(html).not.toMatch(/value="adv"\s+checked/);
		expect(html).not.toMatch(/value="normal"\s+checked/);
	});

	// The label carries the checked state as a class as well as the input carrying the attribute:
	// the custom circle radio is drawn off both, and the JS copy used to set neither.
	it("marks the selected mode's label, which draws the filled circle", () => {
		expect(picker("adv")).toContain('class="stonetop-outfit-load-label is-checked"');
	});

	it("scopes the radio group to the name its caller passes", () => {
		expect(picker("normal", { name: "rollMode" })).toContain('name="rollMode"');
		expect(picker("normal", { name: "stonetop-roll-mode" })).toContain('name="stonetop-roll-mode"');
	});

	// The sheet writes back through the change router as you click; the dialog reads its value once,
	// on submit. Emitting the hook unconditionally would wire the dialog into a router it has none of.
	it("emits the change-router hook only when given one", () => {
		expect(picker("normal", { changeAction: "rollMode" })).toContain('data-change-action="rollMode"');
		expect(picker("normal")).not.toContain("data-change-action");
	});

	it("gives every radio a label to be named by", () => {
		const labels = picker("normal").match(/<span>[^<]+<\/span>/g) ?? [];
		expect(labels).toHaveLength(3);
	});
});

describe("roll-mode picker call sites", () => {
	it("is how the character sheet's side-bar renders its radios", () => {
		const sheet = read("templates/actor/character.hbs");
		expect(sheet).toContain('{{> "stonetop.roll-mode-picker"');
		expect(sheet).not.toContain("stonetop-roll-mode-radio");
	});

	it("is how the stat-pick dialog renders its radios", () => {
		expect(read("templates/apps/roll-pick.hbs")).toContain('{{> "stonetop.roll-mode-picker"');
	});

	// The one that mattered: the dialog's markup was a template literal in ActorRolling.
	it("leaves no hand-built radio markup in JS", () => {
		const js = read("src/actors/ActorRolling.js");
		expect(js).not.toContain("stonetop-roll-mode-radio");
		expect(js).not.toContain("stonetop-outfit-load-label");
	});

	// A fourth copy appearing is the failure this whole change is against.
	it("has no other template rendering roll-mode radios", () => {
		const hbs = [];
		const walk = dir => {
			for (const e of readdirSync(path.join(root, dir), { withFileTypes: true })) {
				const rel = path.join(dir, e.name);
				if (e.isDirectory()) walk(rel);
				else if (e.name.endsWith(".hbs")) hbs.push(rel);
			}
		};
		walk("templates");
		const others = hbs.filter(f => !f.endsWith("roll-mode-picker.hbs") && read(f).includes("stonetop-roll-mode-radio"));
		expect(others).toEqual([]);
	});

	// Not an oversight: the steading draws its own box glyph, and orders the modes normal/adv/dis
	// against the picker's adv/normal/dis. Sharing the partial would silently restyle and reorder it.
	it("is deliberately not used by the steading, which draws a different control", () => {
		const steading = read("templates/actor/steading.hbs");
		expect(steading).toContain("steading-roll-mode-radio");
		expect(steading).not.toContain('{{> "stonetop.roll-mode-picker"');
	});
});
