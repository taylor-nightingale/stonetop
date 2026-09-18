import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// The Level Up strip lives in the stats column, which is as wide as the five resource frames above
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

// Markup as level-up-strip.hbs and level-up-step.hbs emit it — the rules under test are
// selector-specific, so a simplified stand-in would stop matching them.
const step = ({ kind, done = false, text, figure = null, control = false, goto = null }) => `
<li class="stonetop-levelup-step${done ? " is-done" : ""}" data-kind="${kind}">
  ${done
		? `<span class="stonetop-levelup-tick" role="img" aria-label="Done"><i class="fas fa-check" aria-hidden="true"></i></span>`
		: `<span class="stonetop-levelup-tick" aria-hidden="true"></span>`}
  <div class="stonetop-levelup-body">
    <div class="stonetop-levelup-text stonetop-rich">${text}</div>
    ${figure ? `<p class="stonetop-levelup-figure">${figure}</p>` : ""}
  </div>
  ${control ? `<button type="button" class="stonetop-levelup-advance" data-action="advance">Advance</button>` : ""}
  ${goto ? `<button type="button" class="stonetop-levelup-goto" data-action="goToTab" data-view-state data-tab="${goto}">
      <span>${goto}</span><i class="fas fa-arrow-right" aria-hidden="true"></i></button>` : ""}
</li>`;

// The column is pinned to the width the five resource frames give it in play; the whole claim is
// that the strip keeps inside that.
const FIXTURE = `
<div class="application stonetop sheet actor character themed theme-light"><div class="window-content">
  <div class="stonetop-stats-column" style="width: 380px">
    <div class="stonetop-vitals-section">
      <div class="stonetop-resource-row">
        <div class="stonetop-resource stonetop-resource--wide is-full">
          <span class="stonetop-resource__label">XP</span>
          <div class="stonetop-resource__split">
            <span class="stonetop-stepper"><input class="stonetop-resource__input stonetop-char-xp stonetop-step" type="number" value="19"></span>
            <span>/</span>
            <span class="stonetop-resource__max">16</span>
          </div>
        </div>
      </div>
    </div>
    <div class="stonetop-levelup is-ready">
      <button type="button" class="stonetop-levelup-toggle" data-action="toggleTabView"
              data-view-flag="levelUpOpen" data-view-state aria-expanded="true" aria-controls="s1-levelup">
        <i class="fas fa-chevron-right stonetop-levelup-caret" aria-hidden="true"></i>
        <span class="stonetop-levelup-title">Level Up</span>
        <span class="stonetop-levelup-badge">ready</span>
      </button>
      <div class="stonetop-levelup-panel" id="s1-levelup">
        <p class="stonetop-levelup-gloss">When you have a quiet stretch of time at home and XP equal to (or greater than) 6 + twice your current level.</p>
        <ol class="stonetop-levelup-steps">
          ${step({ kind: "advance", text: "Spend XP to level up", figure: "16 XP: 19 → 3 · Level 5 → 6", control: true })}
          ${step({ kind: "chooseMove", done: true, text: "Choose a new move from your playbook, or an insert class that you've unlocked.", goto: "Moves" })}
          ${step({ kind: "review", text: "Review your Instinct and Appearance. Change anything that no longer applies. Feel free to make up new options.", goto: "Playbook" })}
        </ol>
      </div>
    </div>
  </div>
</div></div>`;

const TARGETS = {
	column:   ".stonetop-stats-column",
	strip:    ".stonetop-levelup",
	toggle:   ".stonetop-levelup-toggle",
	title:    ".stonetop-levelup-title",
	badge:    ".stonetop-levelup-badge",
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

	it("keeps inside the stats column it hangs under", () => {
		expect(right(el("strip"))).toBeLessThanOrEqual(right(el("column")) + 1);
		for (const name of ["toggle", "gloss", "advanceText", "advanceFig", "chooseText", "reviewText"]) {
			expect(right(el(name)), `${name} runs past the column`)
				.toBeLessThanOrEqual(right(el("column")) + 1);
		}
	});

	// Core's `.window-app button { width: 100% }` is what this catches: a stretched Advance would be
	// a full-width bar across a checklist row.
	it("keeps the Advance control to its own words", () => {
		expect(el("advance").values.boxWidth).toBeLessThan(el("advanceRow").values.boxWidth / 2);
	});

	it("keeps the tab link to its own words too", () => {
		expect(el("goto").values.boxWidth).toBeLessThan(el("column").values.boxWidth / 2);
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
	it("crops nothing", () => {
		for (const [name, m] of measured) {
			expect(m.overflowY, `${name} crops ${m.overflowY}px vertically`).toBe(0);
			expect(m.overflowX, `${name} crops ${m.overflowX}px horizontally`).toBe(0);
		}
	});
});
