import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe, pseudoAsClass } from "./RenderProbe.js";

// Where the ? lands is decided by the cascade, not by the markup: core's `.window-app` button rules
// stretch buttons to full width, and the steading panel's content-lifting rule out-specifies any
// child's own `position: absolute` unless the child opts out. Both failures look fine to a text scan
// of the stylesheet — a full-width bar with a centred icon across the top of a panel still parses.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
]);

// Markup as the partials emit it — the rules under test are selector-specific, so a simplified
// stand-in would stop matching them.
const adviceButton = (variant, extra = "") => `
<button type="button" data-action="showAdvice" data-topic="prosperity" data-view-state
        title="If you want to… improve Prosperity" aria-label="If you want to… improve Prosperity"
        class="stonetop-advice-btn stonetop-advice-btn--${variant} ${extra}">
  <i class="fas fa-circle-question" aria-hidden="true"></i>
</button>`;

const FIXTURE = `
<div class="application stonetop sheet steading themed theme-light"><div class="window-content">
  <section class="steading-ledger">
    <div class="steading-tile steading-prosperity" data-attr="prosperity">
      <span class="steading-tile-label">
        <button class="steading-stat-roll rollable" type="button" data-roll="prosperity">Prosperity</button>
        ${adviceButton("inline", "stonetop-icon-btn")}
      </span>
      <span class="steading-tile-value">
        <span class="stonetop-stepper">
          <input type="number" class="stonetop-step steading-attr-input" data-attr="prosperity" value="1" step="1" min="-1" max="3">
          <button type="button" tabindex="-1" class="stonetop-stepper-btn stonetop-stepper-btn--up" data-step-dir="1">▲</button>
          <button type="button" tabindex="-1" class="stonetop-stepper-btn stonetop-stepper-btn--down" data-step-dir="-1">▼</button>
        </span>
        <em class="steading-tile-adjustment">−1 lacking</em>
      </span>
    </div>
  </section>
  <div class="steading-coinage">
    <h3 class="stonetop-move-group-title">Coinage${adviceButton("inline", "stonetop-icon-btn")}</h3>
    <div class="stonetop-panel-divider" aria-hidden="true"></div>
    <table class="steading-coinage-table">
      <thead><tr><th scope="col" class="steading-coinage-corner">Currency</th><th scope="col">Purses</th><th scope="col">Handfuls</th></tr></thead>
      <tbody>
        <tr><th scope="row" class="steading-coinage-name">Silver</th>
          <td class="steading-coinage-cell"><input type="number" class="stonetop-coinage-input" value="0"></td>
          <td class="steading-coinage-cell"><input type="number" class="stonetop-coinage-input" value="0"></td></tr>
      </tbody>
    </table>
  </div>
  <!-- width pinned: in play the tab fills the sheet, and the claim is that the button keeps to one end of it -->
  <div class="tab followers" style="width: 640px">
    <div class="stonetop-advice-toolbar">
      <button type="button" data-action="showAdvice" data-topic="followers" data-view-state
              class="stonetop-advice-btn stonetop-advice-btn--labelled stonetop-view-toggle">
        <i class="fas fa-circle-question" aria-hidden="true"></i><span>If you want to… recruit followers</span>
      </button>
    </div>
    <div class="stonetop-followers-grid">a follower card</div>
  </div>
</div></div>`;

// The dialog is its own window, not part of a sheet — this is what proves its list still picks up
// the book's swirl bullets rather than falling back to browser discs.
const DIALOG = `
<div class="application dialog stonetop stonetop-advice-dialog themed theme-light"><div class="window-content">
  <div class="stonetop-advice">
    <p>The main ways are:</p>
    <ul class="stonetop-advice-options"><li>Return Triumphant.</li></ul>
  </div>
</div></div>`;

const TARGETS = {
	panel:   ".steading-prosperity",
	heading: ".steading-prosperity .steading-tile-label",
	roll:    ".steading-prosperity .steading-stat-roll",
	inline:  ".steading-prosperity .stonetop-advice-btn--inline",
	coinage: ".steading-coinage",
	coinHeading: ".steading-coinage .stonetop-move-group-title",
	coinAdvice: ".steading-coinage .stonetop-advice-btn--inline",
	coinTable: ".steading-coinage-table",
	toolbar:  ".tab.followers .stonetop-advice-toolbar",
	labelled: ".tab.followers .stonetop-advice-btn--labelled",
	grid:     ".stonetop-followers-grid",
};

const right = el => el.values.boxLeft + el.values.boxWidth;

describe.skipIf(!canProbe())("the advice ? button", () => {
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

	// Core's `.window-app button { width: 100% }` is what this catches: a stretched button would be
	// as wide as the tile's label and push the rating's name off it.
	it("takes only the width of its icon, not the whole label", () => {
		expect(el("inline").values.boxWidth).toBeLessThan(el("heading").values.boxWidth / 2);
	});

	// The tile's label is a fixed grid column, so the ? has no far end to be flush with — the claim
	// worth pinning is that it follows the rating's name rather than preceding or overlapping it.
	it("follows the rating's name", () => {
		expect(el("inline").values.boxLeft).toBeGreaterThanOrEqual(right(el("roll")));
		expect(right(el("inline"))).toBeLessThanOrEqual(right(el("heading")) + 2);
	});

	it("stays on the label's line rather than adding a row", () => {
		expect(Math.abs(el("inline").boxMiddle - el("heading").boxMiddle)).toBeLessThan(4);
	});

	// The ? rides the coinage block's own HEADING — the placement every other ? on this sheet uses.
	// It used to ride the first currency's name row, because the block had no heading, and that row
	// then had to be ordered around the button to keep the hairline from running through the glyph.
	//
	// `margin-left: auto` only reaches the far end if the heading is a flex line, which a bare <h3>
	// is not: the rule granting that is keyed off the button's presence, so this is the assertion
	// that the cascade actually finds it.
	it("rides the block's heading, flush with its far end", () => {
		expect(el("coinAdvice").missing).toBe(false);
		expect(Math.abs(right(el("coinAdvice")) - right(el("coinHeading")))).toBeLessThan(2);
	});

	it("stays on the heading's line, with the table clear below it", () => {
		expect(el("coinAdvice").boxMiddle).toBeCloseTo(el("coinHeading").boxMiddle, 0);
		const bottom = el("coinAdvice").values.boxTop + el("coinAdvice").values.boxHeight;
		expect(el("coinTable").values.boxTop).toBeGreaterThanOrEqual(bottom - 1);
	});
});

describe.skipIf(!canProbe())("the advice toolbar on a tab", () => {
	let measured;
	beforeAll(() => {
		measured = probe.measure({
			bodyHtml: FIXTURE, bodyClass: "theme-light",
			rootAttrs: 'style="font-size: 16px"', targets: TARGETS,
		});
	});
	const el = name => measured.get(name);

	// It says what it does, so unlike the icon-only variants it has to fit its own words.
	it("fits its label", () => {
		expect(el("labelled").overflows).toBe(false);
	});

	it("keeps to the right rather than spanning the tab", () => {
		expect(el("labelled").values.boxWidth).toBeLessThan(el("toolbar").values.boxWidth / 2);
		expect(Math.abs(right(el("labelled")) - right(el("toolbar")))).toBeLessThan(2);
	});

	it("sits above the tab's content, clear of it", () => {
		const bottom = el("toolbar").values.boxTop + el("toolbar").values.boxHeight;
		expect(el("grid").values.boxTop).toBeGreaterThan(bottom);
	});
});

describe.skipIf(!canProbe())("the advice dialog", () => {
	let probed;
	beforeAll(() => {
		probed = probe.render({
			bodyHtml: DIALOG, bodyClass: "theme-light",
			probes: {
				bullet: { selector: ".stonetop-advice-options li", pseudo: "::before",
				          properties: ["mask-image", "background-color"] },
				list:   { selector: ".stonetop-advice-options", properties: ["list-style-type"] },
			},
		});
	});

	// The dialog is not a `.sheet`, so it takes the shared bullet rule only because that rule names
	// it — this is the assertion that the reuse actually reaches.
	it("draws the book's swirl bullets, not browser discs", () => {
		expect(probed.get("list").get("list-style-type")).toBe("none");
		expect(probed.get("bullet").get("mask-image")).toContain("swirl.png");
	});
});

// ── Hover ────────────────────────────────────────────────────────────────────────
//
// Core's `button:hover` (layer elements.forms) repaints background and text TOGETHER. The icon
// button suppresses the background, so inheriting core's hover text colour paints the glyph in the
// page's own paper colour — the ? vanishes under the cursor. The existing icon buttons never showed
// this because they hold an <img>, which ignores `color`; a font glyph does not.
//
// Headless Chrome cannot force :hover, so the stylesheets are rewritten with `:hover` → `.is-hover`.
// A class and a pseudo-class have identical specificity and the rewrite leaves every rule in its own
// @layer, so the cascade under test is the real one.
const hoverProbe = () => new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
], { transformCss: pseudoAsClass("hover") });

const hoverFixture = theme => `
<div class="application stonetop sheet steading themed theme-${theme}"><div class="window-content">
  <div class="steading-tile steading-prosperity">
    <span class="steading-tile-label"><button class="steading-stat-roll rollable" type="button">Prosperity</button>
      <button type="button" data-action="showAdvice" data-topic="prosperity"
              class="stonetop-advice-btn stonetop-advice-btn--inline stonetop-icon-btn is-hover">
        <i class="fas fa-circle-question"></i></button></span>
  </div>
</div></div>`;

describe.skipIf(!canProbe())("the ? under the cursor", () => {
	let light, dark;
	beforeAll(() => {
		const probe = hoverProbe();
		const read = theme => probe.render({
			bodyHtml: hoverFixture(theme), bodyClass: `theme-${theme}`,
			probes: {
				icon:  { selector: ".stonetop-advice-btn", properties: ["color", "background-color", "opacity"] },
				paper: { selector: ".window-content", properties: ["background-color"] },
			},
		});
		light = read("light");
		dark  = read("dark");
	});

	it.each([["light"], ["dark"]])("stays a different colour from the paper behind it (%s)", theme => {
		const probed = theme === "light" ? light : dark;
		expect(probed.get("icon").missing).toBe(false);
		expect(probed.get("icon").get("color")).not.toBe(probed.get("paper").get("background-color"));
	});

	// Suppressing the background is the whole reason the text colour matters — if core's hover
	// background ever won here, the glyph would sit on a sepia pill instead and this would be moot.
	it("keeps the button transparent, as it is at rest", () => {
		expect(light.get("icon").get("background-color")).toBe("rgba(0, 0, 0, 0)");
	});

	it("is fully opaque under the cursor", () => {
		expect(light.get("icon").get("opacity")).toBe("1");
	});
});
