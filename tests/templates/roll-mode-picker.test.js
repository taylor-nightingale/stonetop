import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { renderPartial } from "../fakes/renderTemplate.js";
import { RollModes } from "../../src/actors/RollModes.js";

// The roll-mode radios existed three times: the character sheet's move side-bar, the stat-pick
// dialog (built as a JS string), and the steading sheet. All three render from ONE partial now.
//
// The steading's was the last holdout, kept separate because a stacked column of radios is most of a
// header row's height. That is a LAYOUT reason, so it is answered with a variant class rather than a
// second template: `inline` for both sheets' headers, `stacked` for the dialog. The tests below pin
// that every call site goes through the partial, which is what stops a fourth copy appearing.

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
	it("marks the selected mode's label, which is what the accent and the mark are drawn off", () => {
		expect(picker("adv")).toContain('class="stonetop-rollmode-option is-checked"');
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
		const labels = picker("normal").match(/<span class="stonetop-rollmode-label">[^<]+<\/span>/g) ?? [];
		expect(labels).toHaveLength(3);
	});

	// Three radios that mean one setting are a group; a group with no accessible name is three loose
	// words. The legend carries it on both variants — inline only hides it visually.
	it("wraps the options in a named group", () => {
		const html = picker("normal");
		expect(html).toContain("<fieldset");
		expect(html).toContain('class="stonetop-rollmode-legend"');
	});

	// The variant is the whole of what differs between the three surfaces.
	it("takes its arrangement from the variant, defaulting to inline", () => {
		expect(picker("normal", { variant: "stacked" })).toContain("stonetop-rollmode--stacked");
		expect(picker("normal", { variant: "inline" })).toContain("stonetop-rollmode--inline");
		expect(picker("normal")).toContain("stonetop-rollmode--inline");
	});
});

describe("roll-mode picker call sites", () => {
	// ONE picker on the character sheet, in the band's foot, and the fold does not reach it. It was
	// rendered twice — stacked beside Damage while the band was open, inline on the folded line — and
	// two radios sharing a `name` are ONE group with one checked member, so whichever copy parsed last
	// was the one the browser believed. The foot is the line the numbers fold TO, so a control that
	// ends it ends it at both densities without moving.
	//
	// NOT on the shared actor header, which the NPC card also renders — and where it spent a spell
	// as three words at the end of a line with nothing to align to.
	it("renders exactly one picker on the character sheet", () => {
		const character = read("templates/actor/character.hbs");
		expect(character.match(/stonetop\.roll-mode-picker/g) ?? [], "the character sheet renders a second picker")
			.toHaveLength(1);
		expect(character, "the character sheet's picker is not the inline one").toContain('variant="inline"');
		expect(character).not.toContain("stonetop-roll-mode-radio");
		expect(read("templates/actor/partials/actor-header.hbs"), "the masthead still renders a mode")
			.not.toContain("roll-mode-picker");
	});

	// The folded line carries the NUMBERS at line height and nothing else. A picker in here would be
	// the second copy again, with the fold deciding which one the browser believed.
	it("keeps the picker out of the folded line", () => {
		expect(read("templates/actor/partials/folded-ledger.hbs"), "the folded line renders its own picker")
			.not.toContain("roll-mode-picker");
	});

	// One picker, so the group name is stated once — but it is still stated, because the radios are a
	// group and an unnamed group is three loose radios.
	it("scopes the character sheet's radios to a named group", () => {
		expect(read("templates/actor/character.hbs")).toContain('name="stonetop-roll-mode"');
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
		const others = hbs.filter(f => !f.endsWith("roll-mode-picker.hbs") && read(f).includes("stonetop-rollmode-input"));
		expect(others).toEqual([]);
	});

	// The last copy, folded in. The steading's control was hand-rolled markup rendering the shared
	// RollModes list; it is the same partial now, asking for the same `inline` variant the character
	// sheet's masthead asks for. Nothing about the two is allowed to drift again.
	it("is how the steading's ledger line renders its radios", () => {
		const steading = read("templates/actor/steading.hbs");
		expect(steading).toContain('{{> "stonetop.roll-mode-picker"');
		expect(steading).toContain("stonetop.rollModes");
		expect(steading).not.toContain("steading-rollmode-input");
		// The retired ladder glyph is gone from the header along with the rating ladders.
		expect(steading).not.toContain("steading-roll-mode-radio");
		expect(steading).not.toContain("steading-box-input");
	});

	// Both sheets ask for the same arrangement, because both put the control at the end of a line: the
	// steading's ledger line and the character band's foot. `stacked` is the dialog's alone, where the
	// choice IS the box — a column of circle radios on a sheet is most of a header row's height for a
	// setting that is three words wide.
	it("gives both sheets the same variant", () => {
		for (const f of ["templates/actor/steading.hbs", "templates/actor/character.hbs"])
			expect(read(f), `${f} does not ask for the inline variant`).toContain('variant="inline"');
		for (const f of ["templates/actor/steading.hbs", "templates/actor/character.hbs"])
			expect(read(f), `${f} puts a stacked column of radios on a sheet`).not.toContain('variant="stacked"');
	});
});
