import { describe, it, expect } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

/**
 * The rail, as a drawer.
 *
 * Below the layout's breakpoint the rail slides over the tab behind a toggle. Three things have to
 * be true of that, and none of them can be read off the stylesheet:
 *
 *  1. The toggle is not underneath the rail it opens. `.stonetop-rail` and the toggle are both
 *     positioned, and the rail reserves a top strip for the button by padding — which any
 *     sheet-specific `padding-top` silently out-specifies, putting the arches over the control. That
 *     is exactly what happened, and text could not see it: both rules are valid and both "apply".
 *  2. The two sides mirror. `data-side` is the only thing that says which edge, so a rule written
 *     for one side and not the other shows up as a drawer that slides in from the wrong place.
 *  3. The toggle clears the SC 2.5.8 target-size floor of 24px.
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

const fixture = ({ side, open, width }) => `
<div class="application stonetop sheet actor steading themed theme-light" style="width: ${width}px">
  <div class="window-content"><div class="sheet-wrapper">
   <div class="stonetop-rail-layout${open ? " rail-open" : ""}" data-side="${side}" style="height: 600px">
    <button type="button" class="stonetop-rail-toggle" data-action="toggleRail" aria-expanded="${open}" aria-label="Rail">
      <i class="fas fa-archway"></i>
    </button>
    <div class="stonetop-rail steading-rail" data-density="full">
      <div class="steading-archpair">
        <div class="steading-tile steading-fortunes steading-tile--arched" data-attr="fortunes">
          <span class="steading-arch" aria-hidden="true"><img class="steading-tile-badge" src="" alt=""></span>
          <span class="steading-tile-label"><span class="steading-tile-title">Fortunes</span></span>
        </div>
      </div>
    </div>
   <div class="stonetop-rail-main steading-main">
    <section class="sheet-body"><div class="tab active" data-tab="play">Tab content</div></section>
   </div>
   </div>
  </div></div>
</div>`;

const TARGETS = {
	toggle:  ".stonetop-rail-toggle",
	rail:    ".stonetop-rail",
	archpair: ".steading-archpair",
	main:    ".stonetop-rail-main",
};

const measure = opts => probe.measure({
	bodyHtml: fixture(opts), bodyClass: "theme-light",
	rootAttrs: 'style="font-size: 16px"', targets: TARGETS,
	chromeFlags: [`--window-size=${opts.width + 40},900`],
});

describe.skipIf(!canProbe())("the rail as a drawer", () => {
	describe("open, on the left", () => {
		const m = () => measure({ side: "left", open: true, width: 760 });

		// The regression this file exists for.
		it("does not put the rail's first row over the button that opened it", () => {
			const r = m();
			const toggle = r.get("toggle").values;
			const arch   = r.get("archpair").values;
			expect(toggle.boxWidth, "the toggle is not drawn at this width").toBeGreaterThan(0);
			expect(arch.boxTop, `the arches start ${Math.round(toggle.boxBottom - arch.boxTop)}px over the toggle`)
				.toBeGreaterThanOrEqual(toggle.boxTop + toggle.boxHeight);
		});

		it("slides in from the left edge, over the tab", () => {
			const r = m();
			const rail = r.get("rail").values;
			const main = r.get("main").values;
			expect(rail.boxLeft).toBeLessThanOrEqual(main.boxLeft + 1);
			expect(rail.boxWidth).toBeGreaterThan(0);
		});
	});

	// data-side is the only thing that says which edge; a rule written for one side only shows up as
	// a drawer that comes in from the wrong place.
	it("mirrors: on the right it slides in from the right edge", () => {
		const r = measure({ side: "right", open: true, width: 760 });
		const rail = r.get("rail").values;
		const main = r.get("main").values;
		expect(rail.boxLeft + rail.boxWidth).toBeGreaterThan(main.boxLeft + main.boxWidth - 1);
	});

	// SC 2.5.8: 24px is the floor, and the toggle sits alone in a corner with nothing to spare.
	it("gives the toggle a target that clears 24px", () => {
		const toggle = measure({ side: "left", open: false, width: 760 }).get("toggle").values;
		expect(toggle.boxWidth).toBeGreaterThanOrEqual(24);
		expect(toggle.boxHeight).toBeGreaterThanOrEqual(24);
	});

	// Above the breakpoint the rail is an inline column, so there is nothing to disclose and the
	// button must not be taking up a corner of the tab.
	it("hides the toggle entirely while the rail is inline", () => {
		const toggle = measure({ side: "left", open: false, width: 1400 }).get("toggle").values;
		expect(toggle.boxWidth).toBe(0);
	});
});
