import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { existsSync, readdirSync } from "fs";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// What the improvement card's chip row must do, settled in a browser with core's own stylesheet and
// core's own FontAwesome — both taken from the local Foundry install, so the cascade and the icon
// metrics are the ones the game actually has.
//
// The chips are the SHUT view. An open card states every one of those payloads in the book's words
// with a control beside it, so leaving the chips up is the same reward said twice an inch apart —
// the exact duplication the card was rebuilt to remove.
//
// NOT asserted here, deliberately: that every chip is the same height. It was, on the way in — the
// suspicion being that a granted-move chip's die glyph made its chip taller. Measured against the
// real font, it does not: FontAwesome's `.fas` sets a family and a line-height, not a larger size, so
// a die costs a chip nothing. The assertion could not be made to fail under any stylesheet, which
// makes it decoration. The thing problem 8 actually describes is different — whole CARD ROWS
// differing in height because some improvements have one chip and others wrap to three — and that is
// a layout decision, not a bug in this rule.

const STYLES = path.resolve("styles");
const sheet = (f) => path.join(STYLES, f);

/**
 * Core's REAL FontAwesome, from the same local Foundry install the probe already takes foundry2.css
 * from — not a stub of it.
 *
 * This file was written twice against a synthetic stand-in first, and both were wrong in the same
 * direction: an empty `<i class="fas">` contributes no line box, so every chip measured level on the
 * broken stylesheet too. A stub good enough to reproduce the bug turned out to be a stub whose
 * metrics were the thing under test. The real font settles it, and it is sitting on disk.
 */
function fontAwesomeCss() {
	const home = process.env.HOME ?? "";
	const installs = existsSync(home)
		? readdirSync(home).filter(d => /^FoundryVTT/.test(d)).sort().reverse()
		: [];
	for (const dir of installs) {
		const css = path.join(home, dir, "resources/app/public/fonts/fontawesome/css/all.min.css");
		if (existsSync(css)) return css;
	}
	return null;
}

const iconFont = fontAwesomeCss();

const probe = new RenderProbe([
	sheet("themes/palette.css"), sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"), sheet("tokens.css"), sheet("stonetop.css"),
	// Last, so it stands where a module's stylesheet would; our own rule beats its `.fas` on
	// specificity rather than on order, which is the arrangement in the running game.
	...(iconFont ? [iconFont] : []),
]);

const plainChips = prefix => `
	<li class="steading-effect-chip" id="${prefix}-delta">
		<span class="steading-effect-amount">+1</span>
		<span class="steading-effect-subject">Fortunes</span>
	</li>
	<li class="steading-effect-chip" id="${prefix}-entry">
		<span class="steading-effect-subject">Resources:</span>
		<span class="steading-effect-entry">Mill</span>
	</li>`;

// A granted-move chip: the one carrying a die, and the one that was taller than the rest.
const moveChip = prefix => `
	<li class="steading-effect-chip" id="${prefix}-move">
		<i class="fas fa-dice-d6" aria-hidden="true"></i>
		<span class="steading-effect-subject">Lead the Aurochs Hunt</span>
	</li>`;

const card = (id, extraClass, chips) => `
	<div class="steading-improvement-card steading-block ${extraClass}" data-disclosure-row data-slug="${id}">
		<div class="steading-improvement-card-top"><span class="steading-improvement-name">Mill</span></div>
		<ul class="steading-effect-chips stonetop-unmarked" id="${id}-chips">${chips}</ul>
		<div class="steading-improvement-body">
			<div class="steading-payoff"><p class="steading-payoff-head">When you meet the requirements:</p></div>
		</div>
	</div>`;

const FIXTURE = `
<div class="application app stonetop sheet actor steading">
  <div class="window-content">
    ${card("plain", "", plainChips("plain"))}
    ${card("glyph", "", plainChips("glyph") + moveChip("glyph"))}
    ${card("open", "is-open", plainChips("open") + moveChip("open"))}
  </div>
</div>`;

describe.skipIf(!canProbe() || !iconFont)("the improvement card's chips and payoff", () => {
	const boxes = new Map();
	const shown = new Map();

	beforeAll(() => {
		for (const [k, v] of probe.measure({
			bodyHtml: FIXTURE, bodyClass: "game vtt theme-light",
			targets: { glyphDelta: "#glyph-delta", glyphEntry: "#glyph-entry", glyphMove: "#glyph-move" },
		})) boxes.set(k, v);

		for (const [k, v] of probe.render({
			bodyHtml: FIXTURE, bodyClass: "game vtt theme-light",
			probes: {
				openChips:  { selector: "#open-chips",  properties: ["display"] },
				shutChips:  { selector: "#plain-chips", properties: ["display"] },
				payoffHead: { selector: ".is-open .steading-payoff-head", properties: ["margin-top"] },
			},
		})) shown.set(k, v);
	}, 120000);

	it("crops none of them", () => {
		for (const name of ["glyphDelta", "glyphEntry", "glyphMove"]) {
			expect(boxes.get(name).overflows, name).toBe(false);
		}
	});

	it("shows the chips on a shut card and hides them on an open one", () => {
		expect(shown.get("shutChips").get("display")).not.toBe("none");
		expect(shown.get("openChips").get("display")).toBe("none");
	});

	// The first heading sits flush against the rule above it; the second gets air.
	it("does not indent the first payoff heading away from the rule above it", () => {
		expect(parseFloat(shown.get("payoffHead").get("margin-top"))).toBe(0);
	});
});
