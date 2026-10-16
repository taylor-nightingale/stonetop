import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { CssColor } from "./cssColor.js";
import { renderTemplate } from "../fakes/renderTemplate.js";
import { RollPrompt, RollRule } from "../../src/actors/RollPrompt.js";
import { RollableStat } from "../../src/actors/RollableStat.js";
import { RollModeNote, RollModeNotes } from "../../src/model/snapshot/steading/RollModeNote.js";

// The roll dialog follows the theme the way the sheets do. Its V1 predecessor pinned `theme-light`
// whatever the client chose, so on a dark client it stood light-on-dark with ink that was never
// meant for its paper. Only a renderer can say whether the tokens actually reach it.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);
const probe = new RenderProbe([
	sheet("themes/palette.css"), sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"), sheet("tokens.css"), sheet("stonetop.css"),
]);

const stats = ["str", "dex", "int", "wis", "con", "cha"].map(k => new RollableStat(k, k, 1, k.toUpperCase()));
const content = renderTemplate("systems/stonetop/templates/apps/roll-prompt.hbs",
	RollPrompt.forChoice("Defy Danger", stats,
		{ rollerName: "Maelen", rollerNote: "The Seeker", rule: new RollRule("advantage-disadvantage", "A/D") }));

// As DialogV2 draws it: its form, the content, then the footer of buttons.
const button = (key, type) =>
	`<button type="${type}" data-action="${key}" class="stonetop-roll-mode-btn"><span>${key}</span></button>`;
// The frame exactly as v14's DialogV2 renders its header.
const frame = body => `
<dialog open class="application dialog stonetop sheet stonetop-roll-dialog" style="position: static">
  <header class="window-header">
    <i class="window-icon fa-fw fa-solid fa-dice" inert=""></i>
    <h1 class="window-title">Pull Together</h1>
    <button type="button" class="header-control icon fa-solid fa-ellipsis-vertical" aria-label="Toggle Controls" data-action="toggleControls"></button>
    <button type="button" class="header-control icon fa-solid fa-xmark" aria-label="Close Window" data-action="close"></button>
  </header>
  <section class="window-content">
    <form class="dialog-form standard-form">
      <div class="dialog-content standard-form">${body}</div>
      <footer class="form-footer">${button("adv", "button")}${button("normal", "submit")}${button("dis", "button")}</footer>
    </form>
  </section>
</dialog>`;
const FIXTURE = frame(content);

const PULL_TOGETHER = frame(renderTemplate("systems/stonetop/templates/apps/roll-prompt.hbs",
	RollPrompt.forStat("Pull Together", new RollableStat("pop", "Population", 0, "Pop"), {
		rollerName: "Stonetop",
		notes: new RollModeNotes([new RollModeNote({ mode: "adv", source: "Township" })]),
		rule: new RollRule("advantage-disadvantage", "Advantage/Disadvantage"),
	})));

const TARGETS = {
	header:  ".window-header",
	icon:    ".window-icon",
	close:   '.window-header [data-action="close"]',
	formula: ".stonetop-roll-prompt-formula",
	stat:    ".stonetop-roll-prompt-stat",
	notes:   ".stonetop-move-rollnotes",
	rule:    '[data-action="openRule"]',
	footer:  ".form-footer",
};

const BUTTON = ["background-color", "color", "box-shadow", "text-transform", "border-top-style"];
const PROBES = {
	ground:  { selector: ".stonetop-roll-dialog .window-content", properties: ["background-color"] },
	title:   { selector: ".stonetop-roll-prompt-title", properties: ["font-family", "color"] },
	formula: { selector: ".stonetop-roll-prompt-formula", properties: ["color"] },
	die:     { selector: ".stonetop-roll-prompt-die", properties: ["color"] },
	adv:     { selector: '.stonetop-roll-mode-btn[data-action="adv"]', properties: BUTTON },
	normal:  { selector: '.stonetop-roll-mode-btn[data-action="normal"]', properties: BUTTON },
	dis:     { selector: '.stonetop-roll-mode-btn[data-action="dis"]', properties: BUTTON },
};

const colour = v => CssColor.parse(v);
const THEMES = ["theme-light", "theme-dark"];

describe.skipIf(!canProbe())("the roll dialog", () => {
	const probed = {};
	beforeAll(() => {
		for (const theme of THEMES) {
			probed[theme] = probe.render({ bodyHtml: FIXTURE, bodyClass: `game vtt ${theme}`, probes: PROBES });
		}
	}, 120000);
	const get = (theme, name, prop) => probed[theme].get(name).get(prop);
	const paper = theme => colour(get(theme, "ground", "background-color"));

	it.each(THEMES)("stands on opaque paper, in %s", theme => {
		expect(paper(theme).alpha).toBe(1);
	});

	it("follows the theme: light paper in light, dark paper in dark", () => {
		expect(paper("theme-light").relativeLuminance).toBeGreaterThan(0.5);
		expect(paper("theme-dark").relativeLuminance).toBeLessThan(0.2);
	});

	it.each(THEMES)("sets the heading and the formula in ink that reads on its paper, in %s", theme => {
		for (const name of ["title", "formula"]) {
			expect(colour(get(theme, name, "color")).contrastWith(paper(theme)), name).toBeGreaterThanOrEqual(4.5);
		}
	});

	it("sets the heading in the sheets' heading face", () => {
		expect(get("theme-light", "title", "font-family")).toContain("StonetopUI");
	});

	// The dice take the theme's ink; a fixed black die vanishes on dark paper.
	it.each(THEMES)("draws the dice in ink that shows on its paper, in %s", theme => {
		expect(colour(get(theme, "die", "color")).contrastWith(paper(theme))).toBeGreaterThanOrEqual(3);
	});

	// Normal drawn apart from the other two read as already chosen.
	it.each(THEMES)("draws the three modes alike, in %s", theme => {
		for (const prop of BUTTON) {
			expect(get(theme, "normal", prop), prop).toBe(get(theme, "adv", prop));
			expect(get(theme, "dis", prop), prop).toBe(get(theme, "adv", prop));
		}
	});

	it.each(THEMES)("draws them as buttons — filled, lifted, in the label voice — in %s", theme => {
		expect(colour(get(theme, "adv", "background-color")).alpha).toBe(1);
		expect(get(theme, "adv", "box-shadow")).not.toBe("none");
		expect(get(theme, "adv", "text-transform")).toBe("uppercase");
	});

	it.each(THEMES)("keeps the words readable on the fill, in %s", theme => {
		const word = colour(get(theme, "adv", "color"));
		const fill = colour(get(theme, "adv", "background-color"));
		expect(word.contrastWith(fill)).toBeGreaterThanOrEqual(4.5);
	});
});

describe.skipIf(!canProbe())("the roll dialog's layout", () => {
	let box;
	beforeAll(() => {
		const measured = probe.measure({ bodyHtml: PULL_TOGETHER, bodyClass: "game vtt theme-dark", targets: TARGETS });
		box = name => measured.get(name).values;
	}, 60000);
	const right = b => b.boxLeft + b.boxWidth;
	const bottom = b => b.boxTop + b.boxHeight;

	// The hidden title has to keep its room: it is what pushes the controls to the frame's far edge.
	it("keeps the close button at the right of the header, as every window has it", () => {
		expect(right(box("header")) - right(box("close"))).toBeLessThan(16);
		expect(box("close").boxLeft - right(box("icon"))).toBeGreaterThan(100);
	});

	// Pushed to the far edge, the stat read as a stray word rather than what the + 0 is.
	it("sets the stat beside its formula", () => {
		expect(box("stat").boxLeft - right(box("formula"))).toBeLessThan(16);
		expect(box("stat").boxTop).toBeLessThan(bottom(box("formula")));
	});

	it("sets the rule after the reminders, right above the modes", () => {
		expect(box("rule").boxTop).toBeGreaterThanOrEqual(bottom(box("notes")));
		expect(box("footer").boxTop).toBeGreaterThanOrEqual(bottom(box("rule")));
	});
});
