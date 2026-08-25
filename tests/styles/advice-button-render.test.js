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
  <section class="steading-header-grid">
    <div class="steading-stat-panel steading-panel-frame steading-prosperity">
      <span class="panel-corner panel-corner-tl"></span>
      <h2>
        <button class="steading-stat-roll rollable" type="button" data-roll="prosperity">Prosperity</button>
        ${adviceButton("inline", "stonetop-icon-btn")}
      </h2>
      <div class="steading-rating-options"><label class="steading-rating-option">
        <span class="steading-option-text"><span>+1</span></span>
      </label></div>
    </div>
  </section>
  <div class="steading-coinage steading-panel-frame">
    <span class="panel-corner panel-corner-tl"></span>
    <div class="steading-coinage-currency">
      <span class="steading-coinage-name">Silver${adviceButton("inline", "stonetop-icon-btn")}</span>
      <div class="steading-coinage-fields"><label class="steading-coinage-field"><span>Purses</span></label></div>
    </div>
    <div class="steading-coinage-currency"><span class="steading-coinage-name">Gold</span></div>
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
	heading: ".steading-prosperity h2",
	roll:    ".steading-prosperity .steading-stat-roll",
	inline:  ".steading-prosperity .stonetop-advice-btn--inline",
	coinage: ".steading-coinage",
	coinName: ".steading-coinage .steading-coinage-name",
	coinAdvice: ".steading-coinage .stonetop-advice-btn--inline",
	currency: ".steading-coinage-currency",
	coinFields: ".steading-coinage-fields",
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
	// as wide as the heading and push the rating's name off it.
	it("takes only the width of its icon, not the whole heading", () => {
		expect(el("inline").values.boxWidth).toBeLessThan(el("heading").values.boxWidth / 2);
	});

	it("sits at the far end of the heading, after the rating's name", () => {
		expect(el("inline").values.boxLeft).toBeGreaterThanOrEqual(right(el("roll")));
		// Flush with the heading's end — `margin-left: auto` is what puts it there.
		expect(Math.abs(right(el("inline")) - right(el("heading")))).toBeLessThan(2);
	});

	it("stays on the heading's line rather than adding a row", () => {
		expect(Math.abs(el("inline").boxMiddle - el("heading").boxMiddle)).toBeLessThan(4);
	});

	// The currency name's hairline is a flex item that grows to the panel edge — so an absolutely
	// positioned ? sat on top of it, with the line running straight through the glyph. In flow, the
	// hairline stops where the button starts.
	it("does not let the currency hairline run through it", () => {
		expect(el("coinAdvice").missing).toBe(false);
		// Flush with the end of the name row it rides, and clear of the fields below.
		expect(Math.abs(right(el("coinAdvice")) - right(el("coinName")))).toBeLessThan(2);
		expect(el("coinFields").values.boxTop)
			.toBeGreaterThanOrEqual(el("coinAdvice").values.boxTop + el("coinAdvice").values.boxHeight - 1);
	});

	it("keeps the ? on the first currency's row only", () => {
		expect(el("coinAdvice").boxMiddle).toBeCloseTo(el("coinName").boxMiddle, 0);
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
  <div class="steading-stat-panel steading-panel-frame steading-prosperity">
    <h2><button class="steading-stat-roll rollable" type="button">Prosperity</button>
      <button type="button" data-action="showAdvice" data-topic="prosperity"
              class="stonetop-advice-btn stonetop-advice-btn--inline stonetop-icon-btn is-hover">
        <i class="fas fa-circle-question"></i></button></h2>
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
