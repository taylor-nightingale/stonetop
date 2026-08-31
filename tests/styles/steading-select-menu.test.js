import { describe, it, expect } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { CssColor } from "./cssColor.js";
import { renderPartial } from "../fakes/renderTemplate.js";
import { RatingSnapshot } from "../../src/model/snapshot/steading/SteadingSnapshot.js";
import { SteadingDefaults } from "../../src/model/data/steading/SteadingDefaults.js";

/**
 * A <select> whose native chrome we have removed still opens a menu, and the browser paints that
 * menu from the CONTROL's own colours rather than from ours — so a control drawn as bare text on a
 * dark sheet opens a white menu with the sheet's light text on it, unreadable.
 *
 * That is exactly what happened to Size: the fix for it was written once, scoped to
 * `.steading-tile-select`, and the size pill's select carries `.steading-size-select`. One class
 * apart, one menu unreadable, and no reading of the stylesheet says which selects are covered —
 * only rendering every select the sheet actually emits does.
 *
 * So the fixture is the REAL partials, and the assertion is over every <option> found in them.
 */
const STYLES = path.resolve(process.cwd(), "styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
]);

const size = new RatingSnapshot(SteadingDefaults.attributes.size, { current: "city" });

// Both shapes a named rating takes on this sheet: the pill in the masthead, and the tile the
// steadfast item sheet still renders. Either one opens a menu.
const FIXTURE = `
<div class="application stonetop sheet actor steading themed">
 <div class="window-content"><div class="sheet-wrapper">
  <header class="sheet-header steading-line" data-density="line">
    ${renderPartial("stonetop.steading-size-pill", { attrData: size, editable: true })}
  </header>
  <div data-density="full">
    ${renderPartial("stonetop.steading-stat-panel", { attr: "size", attrData: size, editable: true })}
  </div>
 </div></div>
</div>`;

const PROBES = {
	pillOption: { selector: ".steading-size-select option", properties: ["color", "background-color"] },
	tileOption: { selector: ".steading-tile-select option", properties: ["color", "background-color"] },
};

const THEMES = [
	{ name: "dark parchment", bodyClass: "game vtt theme-dark" },
	{ name: "light parchment", bodyClass: "game vtt theme-light" },
];

describe.runIf(canProbe())("the steading's dropdown menus", () => {
	for (const theme of THEMES) {
		describe(theme.name, () => {
			const seen = () => probe.render({ bodyHtml: FIXTURE, bodyClass: theme.bodyClass, probes: PROBES });

			it("paints every option from the sheet's own paper and ink", () => {
				const results = seen();
				for (const [name, probed] of results) {
					expect(probed.missing, `${name} did not render`).toBe(false);
					const ink   = CssColor.parse(probed.get("color"));
					const paper = CssColor.parse(probed.get("background-color"));
					expect(paper, `${name} has no background of its own — the browser will paint it white`)
						.not.toBeNull();
					expect(paper.alpha ?? 1, `${name}'s background is transparent`).toBe(1);
					expect(ink.contrastWith(paper), `${name} is ${ink.contrastWith(paper).toFixed(1)}:1`)
						.toBeGreaterThanOrEqual(4.5);
				}
			});

			// The two selects are one control idiom on one sheet, so their menus cannot differ.
			it("paints the size pill's menu exactly as the rating tile's", () => {
				const results = seen();
				expect(results.get("pillOption").get("background-color"))
					.toBe(results.get("tileOption").get("background-color"));
				expect(results.get("pillOption").get("color"))
					.toBe(results.get("tileOption").get("color"));
			});
		});
	}
});
