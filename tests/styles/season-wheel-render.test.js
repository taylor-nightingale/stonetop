import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

/**
 * The wheel's four segments, as Chrome actually lays them out.
 *
 * The bug this exists to catch was invisible to every reading of the stylesheet, because none of it
 * is written there: core gives each `ol li` a bottom margin and takes it back on `:last-child`, so
 * in a stretch row three segments ended 4px above the pill's floor and the fourth did not. Winter
 * alone painted its tint to the bottom edge, and the words sat above the pill's centre — from CSS
 * that says nothing about heights at all.
 *
 * So the claims here are geometric, and each one is a thing a reader sees: the four segments are one
 * pill, the current one's tint fills its segment, and the word is centred in it — at the sheet's own
 * size and at the largest Font Size step, since the height is meant to come from the type.
 *
 * Nothing in the pill is a control any more: the segments used to disclose each season's Seasons
 * Change move, which now lives in the rail under Seasonal Moves. So the fixture is spans, and the
 * target-size claims went with the buttons.
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

const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];
// Spring is current: the FIRST segment, which is where the last-child margin rule hid the fault.
const CURRENT = 0;

const segment = (name, current) => `
	<li class="steading-wheel-season${current ? " is-current" : ""}"${current ? ' aria-current="true"' : ""}>
		<span class="steading-wheel-name">${name}</span>
	</li>`;

const fixture = `
<div class="application stonetop sheet actor steading themed theme-light">
 <div class="window-content"><div class="sheet-wrapper" data-season="spring">
  <section class="sheet-body">
   <div class="tab active" data-group="primary" data-tab="season">
    <div class="steading-seasons">
     <div class="steading-season-head">
      <ol class="steading-wheel" aria-label="The year">
       ${SEASONS.map((s, i) => segment(s, i === CURRENT)).join("")}
      </ol>
      <p class="steading-season-stated">Spring, year 2</p>
     </div>
    </div>
   </div>
  </section>
 </div></div>
</div>`;

const TARGETS = { wheel: ".steading-wheel" };
SEASONS.forEach((_, i) => {
	TARGETS[`seg${i}`] = `.steading-wheel .steading-wheel-season:nth-child(${i + 1})`;
	TARGETS[`name${i}`] = `.steading-wheel .steading-wheel-season:nth-child(${i + 1}) .steading-wheel-name`;
});

const measureAt = rootPx => probe.measure({
	bodyHtml: fixture, bodyClass: "theme-light",
	rootAttrs: `style="font-size: ${rootPx}px"`, targets: TARGETS,
});

// The default step, and the largest one the Font Size setting offers — the pair that separates a
// height derived from the type from one pinned to a px.
describe.skipIf(!canProbe())("the season wheel", () => {
	for (const rootPx of [16, 24]) {
		describe(`at a ${rootPx}px root`, () => {
			let m;
			beforeAll(() => { m = measureAt(rootPx); });

			it("gives every season the same segment", () => {
				const heights = SEASONS.map((_, i) => m.get(`seg${i}`).values.boxHeight);
				for (const [i, height] of heights.entries()) {
					expect(height, `${SEASONS[i]} is a different height from spring`)
						.toBeCloseTo(heights[0], 1);
				}
			});

			// The failure in the reader's words: the tint stopped short of the pill's bottom edge on
			// three seasons out of four. A segment shorter than the pill's inner box is that gap.
			it("fills the pill from edge to edge, whichever season is current", () => {
				const wheel = m.get("wheel").values;
				// The pill's inner box: its border box less the 1px rule on each side.
				const inner = wheel.boxHeight - 2;
				for (const [i, name] of SEASONS.entries()) {
					const seg = m.get(`seg${i}`).values;
					expect(seg.boxHeight, `${name} leaves the pill unpainted`).toBeCloseTo(inner, 1);
					expect(seg.boxTop, `${name} sits off the pill's top`).toBeCloseTo(wheel.boxTop + 1, 1);
				}
			});

			// Within a pixel and a half, not to the decimal: where the line box sits inside its own
			// height depends on which font actually finished loading, and that moves the middle by a
			// fraction no reader can see. The fault this holds down was 2.25px at this size and 3.1px
			// at the larger one, so the slack costs nothing.
			it("centres each season's name in its segment", () => {
				for (const [i, name] of SEASONS.entries()) {
					const off = Math.abs(m.get(`name${i}`).firstLineMiddle - m.get(`seg${i}`).boxMiddle);
					expect(off, `${name} rides off centre`).toBeLessThanOrEqual(1.5);
				}
			});
		});
	}

	// The tint is the segment's, and the word is what the segment is sized by: a name narrower than
	// the tint it sits on would leave a dead strip of colour beside it.
	it("fills each segment with the word that names it", () => {
		const m = measureAt(16);
		for (const [i, name] of SEASONS.entries()) {
			const seg  = m.get(`seg${i}`).values;
			const word = m.get(`name${i}`).values;
			expect(word.boxHeight, `${name} is shorter than its segment`).toBeCloseTo(seg.boxHeight, 1);
			expect(word.boxWidth, `${name} is narrower than its segment`).toBeCloseTo(seg.boxWidth, 1);
		}
	});
});
