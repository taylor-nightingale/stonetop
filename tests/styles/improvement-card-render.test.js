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


// ── The card's type scale, and the two lists inside it ──────────────────────────
//
// An improvement card holds two lists of the same kind of thing: what the work REQUIRES and what it
// GIVES YOU. They were set at different sizes, in different faces, on different rhythms, in columns
// 2.5px apart, and only one of them was marked as a list. Every one of those is invisible to a test
// that reads the stylesheet as text — each rule looked reasonable on its own, and the fault was in
// what they came to together, against core's stylesheet and Foundry's own font step.
//
// The scale is declared BY ROLE (stonetop.css:128) and there are exactly two roles in this card:
// prose that introduces a list (--fs-body) and the rows under it (--fs-note). Anything else showing
// up here is a role being borrowed for something it does not describe — which is how the Apply ended
// up at --fs-fine, "page refs and fine print", a step under the result it applies.

const CARD = `
<div class="application app stonetop sheet actor steading" style="width: 700px">
  <div class="window-content">
    <p id="role-body" style="font-size: var(--fs-body)">Sample</p>
    <p id="role-note" style="font-size: var(--fs-note)">Sample</p>

    <div class="steading-improvement-card steading-block is-open">
      <div class="steading-improvement-body">

        <div class="stonetop-choice-entry">
          <div class="stonetop-choice-description" id="card-desc">A shallow creek flows just below the town.</div>
          <div class="stonetop-choice-description" id="card-requires"><strong>Requires</strong> 2 of the following:</div>
          <div class="stonetop-choice-track stonetop-row">
            <div class="stonetop-choice-track-checks"><input type="checkbox" class="stonetop-cg-track"></div>
            <span class="stonetop-choice-track-desc stonetop-choice-track-desc-row" id="card-req-row">A reservoir for the Stream to pool in</span>
          </div>
        </div>

        <div class="steading-payoff">
          <p class="steading-payoff-head" id="card-head">When you <strong><em>meet the requirements</em></strong>:</p>
          <div class="steading-statement">
            <ul class="steading-statement-lines" id="card-auto-list">
              <li class="steading-statement-line" id="card-auto-row">
                <span class="steading-statement-clause" id="card-auto-clause">increase Fortunes by 1</span>
                <button type="button" class="steading-statement-line-btn" id="card-apply">Apply</button>
              </li>
              <li class="steading-statement-line">
                <span class="steading-statement-clause">add them to the Resources list</span>
                <button type="button" class="steading-statement-line-btn">Apply</button>
              </li>
            </ul>
          </div>

          <p class="steading-payoff-head">Henceforth:</p>
          <div class="steading-statement">
            <ul class="steading-statement-lines steading-statement-lines--advisory">
              <li class="steading-statement-line" id="card-adv-row">
                <span class="steading-statement-whens" id="card-whens"><span class="steading-statement-when" id="card-when-1">Spring</span><span class="steading-statement-when" id="card-when-2">Summer</span></span>
                <span class="steading-statement-clause" id="card-adv-clause">the steading generates 1 Surplus</span>
              </li>
            </ul>
          </div>
        </div>

      </div>
    </div>

    <!-- The same partial as the season tab renders it: a table with controls in it, not a list of
         clauses, so it passes no bulleted and keeps its opt-out. -->
    <div class="steading-statement">
      <ul class="steading-statement-lines steading-statement-lines--sourced stonetop-unmarked">
        <li class="steading-statement-line" id="season-row">
          <span class="steading-statement-source">Mill</span>
          <span class="steading-statement-clause">the steading generates +1 Surplus</span>
        </li>
      </ul>
    </div>
  </div>
</div>`;

// Every element in the card that carries text, and the role its content has.
const PROSE = ["card-desc", "card-requires", "card-head"];
const ROWS  = ["card-req-row", "card-auto-row", "card-auto-clause", "card-apply", "card-adv-row",
	"card-whens", "card-adv-clause"];

describe.skipIf(!canProbe())("the improvement card's type scale", () => {
	const styles = new Map();
	const geometry = new Map();

	beforeAll(() => {
		const textProbes = Object.fromEntries([...PROSE, ...ROWS, "role-body", "role-note", "card-auto-list"]
			.map(id => [id, { selector: `#${id}`, properties: ["font-size", "margin-bottom"] }]));

		for (const [k, v] of probe.render({
			bodyHtml: CARD, bodyClass: "game vtt theme-light",
			probes: {
				...textProbes,
				whensDash:   { selector: "#card-whens",  properties: ["content"], pseudo: "::after" },
				secondWhen:  { selector: "#card-when-2", properties: ["content"], pseudo: "::before" },
				firstWhen:   { selector: "#card-when-1", properties: ["content"], pseudo: "::before" },
				payoffMark:  { selector: "#card-auto-clause", properties: ["content", "width", "mask-image"], pseudo: "::before" },
				payoffRowMark: { selector: "#card-auto-row", properties: ["content"], pseudo: "::before" },
				seasonMark:  { selector: "#season-row",    properties: ["content"], pseudo: "::before" },
			},
		})) styles.set(k, v);

		for (const [k, v] of probe.measure({
			bodyHtml: CARD, bodyClass: "game vtt theme-light",
			targets: {
				reqRow:    "#card-req-row",
				autoRow:   "#card-auto-row",
				advClause: "#card-adv-clause",
				whens:     "#card-whens",
			},
		})) geometry.set(k, v);
	}, 120000);

	const px = name => parseFloat(styles.get(name).get("font-size"));

	it("sets the card's prose at the scale's primary-description role", () => {
		for (const id of PROSE) expect(px(id), id).toBe(px("role-body"));
	});

	it("sets every row under it — the controls included — at the row role", () => {
		for (const id of ROWS) expect(px(id), id).toBe(px("role-note"));
	});

	// The fault this catches: the payoff list had no size of its own, so it inherited core's
	// `.window-content` 14px — a size on no role of ours — and its `1.5em` indent was then an em of a
	// font the card does not contain.
	it("leaves nothing in the card inheriting a size from outside the scale", () => {
		const scale = new Set([px("role-body"), px("role-note")]);
		for (const id of [...PROSE, ...ROWS, "card-auto-list"]) expect(scale, id).toContain(px(id));
	});

	it("brings the payoff rows to the column the requirement rows reach past their checkbox", () => {
		expect(geometry.get("autoRow").textLeft).toBeCloseTo(geometry.get("reqRow").textLeft, 0);
	});

	// Core sets `ul li { margin-bottom: 0.25rem }` on every list in a sheet. Carried on top of the
	// list's own gap it put the payoff on a 31px pitch under requirement rows running at 22.5px.
	it("spaces the rows by the list's gap and nothing else", () => {
		expect(parseFloat(styles.get("card-auto-row").get("margin-bottom"))).toBe(0);
	});

	it("puts a Henceforth result's seasons on the first line of the clause they introduce", () => {
		expect(geometry.get("whens").firstLineMiddle)
			.toBeCloseTo(geometry.get("advClause").firstLineMiddle, 0);
	});

	// "Spring — Summer —" reads as spring THROUGH summer, which is the opposite of what a result
	// firing in two seasons and not the one between them does.
	it("conjoins the seasons and closes the group with the dash", () => {
		expect(styles.get("firstWhen").get("content")).toBe("none");
		expect(styles.get("secondWhen").get("content")).toBe('" & "');
		expect(styles.get("whensDash").get("content")).toBe('" — "');
	});

	// Drawn on the row's first CELL, which is the box that holds its first line of text. The row's own
	// box is the Apply's 24px, and it carries no mark of its own — see the bullet rules' comment.
	it("marks the payoff rows with the book's swirl and leaves the season panel's table unmarked", () => {
		expect(styles.get("payoffMark").get("mask-image")).not.toBe("none");
		expect(parseFloat(styles.get("payoffMark").get("width"))).toBeGreaterThan(0);
		expect(styles.get("payoffRowMark").get("content")).toBe("none");
		expect(styles.get("seasonMark").get("content")).toBe("none");
	});

});
