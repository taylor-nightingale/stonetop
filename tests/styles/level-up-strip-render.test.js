import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderLocalized } from "./localizedPartial.js";
import { Advancement } from "../../src/model/data/character/Advancement.js";
import { LevelUpSnapshotBuilder, AdvanceRow, ChooseMoveRow, ReviewRow }
	from "../../src/model/snapshot/character/LevelUpSnapshot.js";

// The Level Up strip lives in the rail, under the XP track it is about — as wide as two stat frames
// it and not a pixel wider. Nothing about that is visible to a text scan of the stylesheet: core's
// `.window-app button { width: 100% }` stretches every button it can reach, and a two-column grid
// whose gutter is a fixed rem is exactly the kind of box that starts cropping when Foundry's font
// setting grows the type. Both failures parse fine.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
]);

// The real partials: the rules under test are selector-specific, and a hand-built stand-in drifted
// from the strip the sheet draws (its trigger sat inside the checklist long after it moved out).
const advancement = new Advancement(5, 19);
const levelUp = new LevelUpSnapshotBuilder()
	.withGloss("have a quiet stretch of time at home and XP equal to (or greater than) 6 + twice your current level")
	.withRows([
		new AdvanceRow({ labelKey: "stonetop.character.levelUp.advanceStep" }, advancement),
		new ChooseMoveRow({ text: "Choose a new move from your playbook, or an insert class that you've unlocked.", tab: "moves" }, advancement, 4),
		new ReviewRow({ text: "Review your Instinct and Appearance. Change anything that no longer applies. Feel free to make up new options.", tab: "playbook" }),
	])
	.withLevel(5).withNewLevel(6).withCost(16).withIsReady(true)
	.build();

// In English words: the harness's keys are forty characters in a control that says "Advance".
const strip = renderLocalized("stonetop.level-up-strip", {
	stonetop: { levelUp }, viewFlags: { levelUpOpen: true }, sheetIdPrefix: "s1", editable: true,
}, "en");

// The strip lives in the RAIL, under the XP bar it is about, and the rail takes its width from the
// stylesheet's own token — so this measures the width the strip actually gets in play.
const FIXTURE = `
<div class="application stonetop sheet actor character themed theme-light" style="width: 900px; height: 700px"><div class="window-content">
  <div class="sheet-wrapper"><div class="stonetop-rail-layout rail-open">
   <div class="stonetop-rail stonetop-moves-rail">
    <div class="stonetop-rail-advancement">${strip}</div>
   </div>
   <div class="stonetop-rail-main character-main"><section class="sheet-body"></section></div>
  </div></div>
</div></div>`;

const TARGETS = {
	rail:     ".stonetop-rail",
	strip:    ".stonetop-levelup",
	toggle:   ".stonetop-levelup-toggle",
	title:    ".stonetop-levelup-title",
	badge:    ".stonetop-levelup-badge",
	home:     ".stonetop-levelup-home",
	gloss:    ".stonetop-levelup-gloss",
	advanceRow:  '[data-kind="advance"]',
	advanceText: '[data-kind="advance"] .stonetop-levelup-text',
	advanceFig:  '[data-kind="advance"] .stonetop-levelup-figure',
	advance:    ".stonetop-levelup-advance",
	tick:       '[data-kind="chooseMove"] .stonetop-levelup-tick',
	chooseText: '[data-kind="chooseMove"] .stonetop-levelup-text',
	goto:       '[data-kind="chooseMove"] .stonetop-levelup-goto',
	reviewText: '[data-kind="review"] .stonetop-levelup-text',
};

const right = el => el.values.boxLeft + el.values.boxWidth;

describe.skipIf(!canProbe())("the Level Up strip", () => {
	// In a hook, not the suite body: skipIf still runs the body, and the probe throws with no Foundry.
	let measured;
	beforeAll(() => {
		measured = probe.measure({
			bodyHtml: FIXTURE, bodyClass: "theme-light",
			rootAttrs: 'style="font-size: 16px"', targets: TARGETS,
		});
	});
	const el = name => measured.get(name);

	it("renders", () => {
		for (const [name, m] of measured) expect(m.missing, `${name} did not render`).toBe(false);
	});

	it("keeps inside the rail it hangs in", () => {
		expect(right(el("strip"))).toBeLessThanOrEqual(right(el("rail")) + 1);
		for (const name of ["toggle", "home", "gloss", "advanceText", "advanceFig", "chooseText", "reviewText"]) {
			expect(right(el(name)), `${name} runs past the rail`)
				.toBeLessThanOrEqual(right(el("rail")) + 1);
		}
	});

	// Where levelling happens, then the book's trigger as its fine print, both above the checklist —
	// read whether or not the checklist is open.
	it("says it is done at home before the fine print and the steps", () => {
		expect(el("home").values.boxTop).toBeGreaterThanOrEqual(el("toggle").values.boxTop + el("toggle").values.boxHeight);
		expect(el("gloss").values.boxTop).toBeGreaterThanOrEqual(el("home").values.boxTop + el("home").values.boxHeight);
		expect(el("advanceRow").values.boxTop).toBeGreaterThan(el("gloss").values.boxTop);
	});

	// Core's `.window-app button { width: 100% }` is what this catches: a stretched Advance would be
	// a full-width bar across a checklist row.
	it("keeps the Advance control to its own words", () => {
		expect(el("advance").values.boxWidth).toBeLessThan(el("advanceRow").values.boxWidth / 2);
	});

	it("keeps the tab link to its own words too", () => {
		expect(el("goto").values.boxWidth).toBeLessThan(el("rail").values.boxWidth / 2);
	});

	// The badge is the only thing on the toggle that says which state the strip is in, so it has to
	// reach the far end rather than sit against the title.
	it("hangs the state badge off the end of the toggle", () => {
		expect(el("badge").values.boxLeft).toBeGreaterThan(right(el("title")));
		expect(right(el("badge"))).toBeLessThanOrEqual(right(el("toggle")) + 1);
	});

	it("puts the tick in a gutter beside the step, not above it", () => {
		expect(right(el("tick"))).toBeLessThanOrEqual(el("chooseText").values.boxLeft + 1);
		expect(Math.abs(el("tick").values.boxTop - el("chooseText").values.boxTop)).toBeLessThan(6);
	});

	// Every step's words wrap; the claim is that nothing is cropped when they do.
	//
	// The rail itself is exempt, and only the rail: it is a scroll container by design
	// (`.stonetop-rail { overflow-y: auto }`), so a strip taller than the window is it working, not
	// it cropping. Everything INSIDE the rail still has to fit what it is given.
	it("crops nothing", () => {
		for (const [name, m] of measured) {
			if (name === "rail") continue;
			expect(m.overflowY, `${name} crops ${m.overflowY}px vertically`).toBe(0);
			expect(m.overflowX, `${name} crops ${m.overflowX}px horizontally`).toBe(0);
		}
	});
});
