import { describe, it, expect } from "vitest";
import path from "path";
import { RenderProbe, MeasuredElement, canProbe } from "./RenderProbe.js";

// Boxes that hold text, measured rather than asserted about.
//
// Raising the type scale is safe everywhere text sizes its own box and unsafe everywhere a box was
// hand-fitted in px to the size the text used to be. The second kind is invisible to a computed
// -style test — `height` still reports the px it was told, while the line inside it is cropped — so
// these read scrollHeight against clientHeight instead, at both ends of Foundry's font ladder.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css")
]);

// Markup copied from the partials that emit these, because the rules are selector-specific and a
// simplified stand-in would silently stop matching them.
const FIXTURE = `
<div class="application stonetop sheet character themed theme-light"><div class="window-content">
  <div class="stonetop-tags" id="t-tags">
    <button type="button" class="stonetop-tag-chip is-selected" id="t-chip">group</button>
  </div>
  <div class="stonetop-intro-step" id="t-step">
    <span class="stonetop-intro-step-num" id="t-step-num">8</span>
    <p>Pick one of the other characters and tell them what you owe them.</p>
  </div>
  <button type="button" class="stonetop-view-toggle" id="t-toggle" data-view-state>
    <i class="fas fa-filter"></i><span>Selected only</span>
  </button>
  <nav class="sheet-tabs" id="t-tabs">
    <a class="item" id="t-tab">Moves</a>
  </nav>
  <div class="stonetop-debilities"><div class="stonetop-debility">
    <label class="stonetop-debility-control" id="t-debility">
      <span class="stonetop-debility-divider"></span>
      <input type="checkbox" class="stonetop-debility-check">
      <span class="stonetop-debility-label" id="t-debility-label">shaky</span>
    </label>
  </div></div>
</div></div>`;

// Boxes that size themselves from their own text. These must fit at every step of the ladder.
const SCALING = {
	chip:    "#t-chip",
	stepNum: "#t-step-num",
	toggle:  "#t-toggle",
	tab:     "#t-tab"
};

// Boxes welded to a fixed-px piece of art — .stonetop-debility-control is 34px because the divider
// PNG above its label is 18px, so it cannot move without the art moving with it. They are correct
// at the default step and crop above it. Asserted at the default rather than skipped, so the day
// the art learns to scale, the failure here is what says so.
const ART_LOCKED = {
	debility:      "#t-debility",
	debilityLabel: "#t-debility-label"
};

/** The ends of core's font ladder, plus the default it ships. */
const FONT_STEPS = [8, 16, 32];
const DEFAULT_STEP = 16;

/** @returns {Map<string, MeasuredElement>} */
function fitAt(rootPx, targets) {
	return probe.measure({
		bodyHtml: FIXTURE,
		bodyClass: "theme-light",
		rootAttrs: `style="font-size: ${rootPx}px"`,
		targets
	});
}

function expectAllFit(measured) {
	for (const [name, el] of measured) {
		expect(el.missing, `${name} did not render`).toBe(false);
		expect(el.overflowY, `${name} crops ${el.overflowY}px of its own text`).toBe(0);
	}
}

describe.skipIf(!canProbe())("text fits its box", () => {
	it.each(FONT_STEPS)("at Foundry font size %ipx", rootPx => {
		expectAllFit(fitAt(rootPx, SCALING));
	});

	it("holds for art-locked boxes at the default font size", () => {
		expectAllFit(fitAt(DEFAULT_STEP, ART_LOCKED));
	});
});

describe("MeasuredElement", () => {
	const at = values => new MeasuredElement("x", values);
	const fitting = { contentWidth: 40, boxWidth: 40, contentHeight: 15, boxHeight: 15 };

	it("reports no overflow when content matches its box", () => {
		const el = at(fitting);
		expect(el.overflows).toBe(false);
		expect(el.overflowY).toBe(0);
		expect(el.overflowX).toBe(0);
	});

	it("reports vertical overflow and by how much", () => {
		const el = at({ ...fitting, contentHeight: 19 });
		expect(el.overflowsY).toBe(true);
		expect(el.overflows).toBe(true);
		expect(el.overflowY).toBe(4);
	});

	it("reports horizontal overflow and by how much", () => {
		const el = at({ ...fitting, contentWidth: 52 });
		expect(el.overflowsX).toBe(true);
		expect(el.overflows).toBe(true);
		expect(el.overflowX).toBe(12);
	});

	it("ignores measurement noise below the visible threshold", () => {
		// A line box a px over its container is font-metric rounding, not a crop a reader can see.
		const el = at({ ...fitting, contentHeight: 16 });
		expect(el.overflowY).toBe(0);
		expect(el.overflowsY).toBe(false);
	});

	it("never reports negative overflow when content is smaller than its box", () => {
		const el = at({ ...fitting, contentHeight: 10, contentWidth: 10 });
		expect(el.overflowY).toBe(0);
		expect(el.overflowX).toBe(0);
	});

	it("knows when its selector matched nothing", () => {
		expect(at({ __missing: true }).missing).toBe(true);
		expect(at(fitting).missing).toBe(false);
	});
});

// The move row body is shared: move-row.hbs renders it for the moves tab AND for the moves an
// arcanum card or a choice grants. The one intended difference between those surfaces is the
// acquisition checkbox, so it is the only thing the layout may differ by — and the description,
// which hangs under the move's NAME, has to follow that difference rather than assume it.
const MOVE_ROW = check => `
<div class="application stonetop sheet character themed theme-light"><div class="window-content">
  <ol class="items-list stonetop-arcanum-moves"><li class="stonetop-item">
    <div class="stonetop-item-header">
      ${check ? '<input type="checkbox" class="stonetop-item-check" checked>' : ""}
      <strong class="stonetop-item-name" id="m-name">Blood &amp; Bone</strong>
    </div>
    <div class="stonetop-item-requirement" id="m-req">Requires: the old power</div>
    <div class="stonetop-item-description" id="m-desc"><p>When you draw on it, roll +CON.</p></div>
  </li></ol>
</div></div>`;

describe.skipIf(!canProbe())("a move's description hangs under its name", () => {
	const leftEdges = check => {
		const m = probe.measure({
			bodyHtml: MOVE_ROW(check),
			bodyClass: "theme-light",
			rootAttrs: 'style="font-size: 16px"',
			targets: { name: "#m-name", requirement: "#m-req", description: "#m-desc" }
		});
		return m;
	};

	it.each([
		["on an arcanum card, where the row has no checkbox", false],
		["in the moves tab, where the row has one", true]
	])("%s", (_label, check) => {
		const m = leftEdges(check);
		// Within a px: the name is bold display type and the description is prose, so their glyph
		// bearings differ slightly even when both start at the same offset.
		expect(m.get("description").textLeft).toBeCloseTo(m.get("name").textLeft, 0);
		expect(m.get("requirement").textLeft).toBeCloseTo(m.get("name").textLeft, 0);
	});

	it("indents both surfaces by exactly the checkbox they do or do not have", () => {
		const withCheck = leftEdges(true).get("description").textLeft;
		const without = leftEdges(false).get("description").textLeft;
		// 14px checkbox + the header's 6px gap.
		expect(withCheck - without).toBeCloseTo(20, 0);
	});
});
