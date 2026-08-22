import { describe, it, expect } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { CssColor } from "./cssColor.js";

// Every control on a sheet suppresses the browser's focus ring somewhere, for good reasons — a
// square ring on a round pip, or over the frame art, looks broken. The failure is that those
// suppressions do not distinguish the mouse from the keyboard, leaving a keyboard user with nothing
// to tell them where they are.
//
// These assert the rendered result rather than the presence of a rule: `outline-style` and a
// non-zero `outline-width`, in a colour that is actually distinguishable from the paper behind it.
// A rule that exists but loses the cascade to one of the nineteen `outline: none` declarations
// above it would pass a text-parsing test and fail this one.
//
// Focusing the field is what makes this measurable: Chrome matches :focus-visible for a text field
// however focus arrived, so the fixture reaches the state without synthesising key events.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css")
]);

/**
 * Controls whose own rules kill the outline, spanning every shape of suppression in the file:
 * a bare `outline: none` on the base rule, one on `:focus`, ones behind selectors far more specific
 * than the guarantee, and one that is itself `!important`.
 *
 * Each entry is [label, markup]. The focused control always carries id="probe-focus".
 */
const SUPPRESSORS = [
	["a follower's name field (base rule, 0,1,0)",
		`<input type="text" id="probe-focus" class="stonetop-follower-name-input" value="Kellen">`],
	["a combobox field (base rule)",
		`<input type="text" id="probe-focus" class="stonetop-combo-input" value="Kellen">`],
	["a fill-in blank (base rule)",
		`<input type="text" id="probe-focus" class="stonetop-fill-blank" value="Kellen">`],
	["a steading attribute (0,6,1 on :focus)",
		`<div class="steading-attr-row"><input type="text" id="probe-focus" value="Marshedge"></div>`],
	["a steading resident (0,6,1 on :focus)",
		`<div class="steading-resident-row"><input type="text" id="probe-focus" value="Aelfa"></div>`],
	["a steading place (0,6,1 on :focus)",
		`<div class="stonetop-places-row"><input type="text" id="probe-focus" value="The Fen"></div>`],
	["a move sheet's name (:focus)",
		`<input type="text" id="probe-focus" class="move-sheet-name" value="Clash">`],
	["a choice option's description (:focus)",
		`<textarea id="probe-focus" class="choices-option-desc">Text</textarea>`]
];

// .steading rides on the root so the steading sheet's own selectors match; it is harmless for the
// other surfaces, which keeps this to one fixture rather than one per sheet type. Focusing the
// control is what makes the state measurable — Chrome matches :focus-visible for a text field
// however focus arrived, so no key events need synthesising.
const fixtureFor = markup => `
<div class="application stonetop sheet character steading themed theme-light"><div class="window-content">
  ${markup}
</div></div>
<script>document.getElementById("probe-focus").focus();</script>`;

const OUTLINE = ["outline-style", "outline-width", "outline-color", "background-color"];

describe.skipIf(!canProbe())("keyboard focus is visible", () => {
	it.each(SUPPRESSORS)("on %s", (_label, markup) => {
		const probed = probe.render({
			bodyHtml: fixtureFor(markup),
			bodyClass: "theme-light",
			rootAttrs: 'style="font-size: 16px"',
			probes: { control: { selector: "#probe-focus", properties: OUTLINE } }
		});
		const control = probed.get("control");

		expect(control.get("outline-style")).not.toBe("none");
		expect(parseFloat(control.get("outline-width"))).toBeGreaterThan(0);
	});

	it.each([["light"], ["dark"]])("in the %s theme, against the paper behind it", theme => {
		const probed = probe.render({
			bodyHtml: fixtureFor(SUPPRESSORS[1][1]).replace(/theme-light/g, `theme-${theme}`),
			bodyClass: `theme-${theme}`,
			rootAttrs: 'style="font-size: 16px"',
			probes: {
				control: { selector: "#probe-focus", properties: OUTLINE },
				paper: { selector: ".window-content", properties: ["background-color"] }
			}
		});
		const ring = CssColor.parse(probed.get("control").get("outline-color"));
		const paper = CssColor.parse(probed.get("paper").get("background-color"));

		// WCAG 2.4.11 asks for 3:1 between a focus indicator and what it sits against.
		expect(ring.contrastWith(paper)).toBeGreaterThanOrEqual(3);
	});

	it("scales the ring with the font setting, so it stays visible when the text grows", () => {
		const widthAt = rootPx => parseFloat(probe.render({
			bodyHtml: fixtureFor(SUPPRESSORS[1][1]),
			bodyClass: "theme-light",
			rootAttrs: `style="font-size: ${rootPx}px"`,
			probes: { control: { selector: "#probe-focus", properties: OUTLINE } }
		}).get("control").get("outline-width"));

		expect(widthAt(32)).toBeCloseTo(widthAt(16) * 2, 1);
	});
});

// WCAG 2.3.3: motion that is decoration, not information, should honour the reader's system
// preference. Asserted through the media query the browser actually evaluates, via Chrome's
// emulation flag, rather than by looking for the rule in the stylesheet text.
describe.skipIf(!canProbe())("reduced motion", () => {
	const MOVING = `
<div class="application stonetop sheet character themed theme-light"><div class="window-content">
  <button type="button" class="stonetop-top-toggle" id="rm-toggle" aria-label="Collapse">
    <i class="fas fa-chevron-up" id="rm-chevron"></i>
  </button>
</div></div>`;

	const durationAt = reduce => probe.render({
		bodyHtml: MOVING,
		bodyClass: "theme-light",
		rootAttrs: 'style="font-size: 16px"',
		probes: { chevron: { selector: "#rm-chevron", properties: ["transition-duration"] } },
		chromeFlags: reduce ? ["--force-prefers-reduced-motion"] : []
	}).get("chevron").get("transition-duration");

	it("animates normally when nothing is asked for", () => {
		expect(parseFloat(durationAt(false))).toBeGreaterThan(0.05);
	});

	it("collapses the transition to nothing when the reader asks for less motion", () => {
		expect(parseFloat(durationAt(true))).toBeLessThan(0.001);
	});
});
