import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderLocalized } from "./localizedPartial.js";
import { Seasons } from "../../src/model/data/steading/Seasons.js";
import { SeasonSnapshot } from "../../src/model/snapshot/steading/TurnoverSnapshot.js";

/**
 * The wheel's four segments, as Chrome actually lays them out — at rest, and in the GM's chooser.
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
 * The chooser is the same pill drawn as a fieldset of radios, so it is held to the same claims: a
 * GM opening the door must see the wheel they were reading, not a different control.
 *
 * The real partial, in English (the new strings have not been translated yet).
 */
const STYLES = path.resolve(process.cwd(), "styles");
const probe = new RenderProbe(["themes/palette.css", "themes/parchment-light.css", "themes/parchment-dark.css", "tokens.css", "stonetop.css"]
	.map(f => path.join(STYLES, f)));

const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];
// Spring is current: the FIRST segment, which is where the last-child margin rule hid the fault.
const CURRENT = "spring";

let HEAD;
beforeAll(() => {
	const all = Seasons.all();
	const season = Seasons.byKey(CURRENT);
	HEAD = renderLocalized("stonetop.steading-season-wheel", {
		sheetIdPrefix: "s1", isGM: true,
		seasons: { turnover: {
			season: new SeasonSnapshot(season, true), year: 2, impression: "",
			wheel: all.map(s => new SeasonSnapshot(s, s.key === season.key)),
		} },
	}, "en");
});

// The door opened, as it opens it: the choosing body shown, the resting one and Change hidden, Done shown.
const opened = html => html
	.replace('id="s1-section-season" hidden', 'id="s1-section-season"')
	.replace(/data-disclosure-open hidden/g, "data-disclosure-open")
	.replace("<span data-disclosure-shut>", "<span data-disclosure-shut hidden>")
	.replace('class="stonetop-section-rest" data-disclosure-shut', 'class="stonetop-section-rest" data-disclosure-shut hidden');

const fixture = head => `
<div class="application stonetop sheet actor steading themed theme-light" style="width: 900px">
 <div class="window-content"><div class="sheet-wrapper" data-season="${CURRENT}">
  <section class="sheet-body">
   <div class="tab active" data-group="primary" data-tab="season">
    <div class="steading-seasons">${head}</div>
   </div>
  </section>
 </div></div>
</div>`;

const REST   = ".stonetop-section-rest .steading-wheel";
const CHOOSE = ".stonetop-section-choose .steading-wheel";

const targetsFor = wheel => {
	const t = { wheel };
	SEASONS.forEach((_, i) => {
		t[`seg${i}`]  = `${wheel} .steading-wheel-season:nth-of-type(${i + 1})`;
		t[`name${i}`] = `${wheel} .steading-wheel-season:nth-of-type(${i + 1}) .steading-wheel-name`;
		t[`radio${i}`] = `${wheel} .steading-wheel-season:nth-of-type(${i + 1}) input`;
	});
	return t;
};

const measureAt = (rootPx, { open = false } = {}) => probe.measure({
	bodyHtml: fixture(open ? opened(HEAD) : HEAD), bodyClass: "theme-light",
	rootAttrs: `style="font-size: ${rootPx}px"`,
	targets: {
		...targetsFor(open ? CHOOSE : REST),
		year: ".steading-season-year input",
		door: ".steading-season-head .stonetop-section-door",
		bar: ".steading-season-head > .stonetop-bar",
	},
});

const WHEELS = [["at rest", false], ["in the GM's chooser", true]];

describe.skipIf(!canProbe())("the season wheel", () => {
	for (const [where, open] of WHEELS) {
		for (const rootPx of [16, 24]) {
			describe(`${where}, at a ${rootPx}px root`, () => {
				let m;
				beforeAll(() => { m = measureAt(rootPx, { open }); });

				it("gives every season the same segment", () => {
					const heights = SEASONS.map((_, i) => m.get(`seg${i}`).values.boxHeight);
					for (const [i, height] of heights.entries()) {
						expect(height, `${SEASONS[i]} is a different height from spring`)
							.toBeCloseTo(heights[0], 1);
					}
				});

				// The failure in the reader's words: the tint stopped short of the pill's bottom edge
				// on three seasons out of four. A segment shorter than the pill's inner box is that gap.
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

				// Within a pixel and a half, not to the decimal: where the line box sits inside its
				// own height depends on which font actually finished loading, and that moves the
				// middle by a fraction no reader can see. The fault this holds down was 2.25px at this
				// size and 3.1px at the larger one, so the slack costs nothing.
				it("centres each season's name in its segment", () => {
					for (const [i, name] of SEASONS.entries()) {
						const off = Math.abs(m.get(`name${i}`).firstLineMiddle - m.get(`seg${i}`).boxMiddle);
						expect(off, `${name} rides off centre`).toBeLessThanOrEqual(1.5);
					}
				});
			});
		}
	}

	// The tint is the segment's, and the word is what the segment is sized by: a name narrower than
	// the tint it sits on would leave a dead strip of color beside it. In the chooser the radio is in
	// the segment too, and must take none of it.
	for (const [where, open] of WHEELS) {
		it(`fills each segment with the word that names it, ${where}`, () => {
			const m = measureAt(16, { open });
			for (const [i, name] of SEASONS.entries()) {
				const seg  = m.get(`seg${i}`).values;
				const word = m.get(`name${i}`).values;
				expect(word.boxHeight, `${name} is shorter than its segment`).toBeCloseTo(seg.boxHeight, 1);
				expect(word.boxWidth, `${name} is narrower than its segment`).toBeCloseTo(seg.boxWidth, 1);
			}
		});
	}

	// Opening the door must not move the wheel: the GM is choosing on the pill they were reading.
	it("draws the chooser's pill exactly where and as large as the resting one", () => {
		const rest = measureAt(16).get("wheel").values;
		const choose = measureAt(16, { open: true }).get("wheel").values;
		expect(choose.boxWidth).toBeCloseTo(rest.boxWidth, 0);
		expect(choose.boxHeight).toBeCloseTo(rest.boxHeight, 0);
		expect(choose.boxTop).toBeCloseTo(rest.boxTop, 0);
		expect(choose.boxLeft).toBeCloseTo(rest.boxLeft, 0);
	});

	// The year sits on the pill's line rather than under it: a row, not a form.
	it("puts the year beside the pill", () => {
		const m = measureAt(16, { open: true });
		const wheel = m.get("wheel");
		const year = m.get("year");
		expect(Math.abs(year.boxMiddle - wheel.boxMiddle)).toBeLessThanOrEqual(3);
		expect(year.values.boxLeft).toBeGreaterThan(wheel.values.boxLeft + wheel.values.boxWidth);
	});

	// The door hangs from the bar, the way every section's does, and the bar does not grow for it.
	it("hangs the door from the bar without growing it", () => {
		const m = measureAt(16);
		const bar = m.get("bar").values;
		const door = m.get("door").values;
		expect(door.boxTop).toBeCloseTo(bar.boxTop, 0);
		expect(door.boxHeight).toBeGreaterThan(bar.boxHeight);
	});
});

// Colour and type are computed values, not geometry.
describe.skipIf(!canProbe())("the chooser's marks", () => {
	let v;
	beforeAll(() => {
		const seg = i => `${CHOOSE} .steading-wheel-season:nth-of-type(${i + 1})`;
		v = probe.render({
			bodyHtml: fixture(opened(HEAD)), bodyClass: "theme-light", rootAttrs: 'style="font-size: 16px"',
			probes: {
				current: { selector: seg(0), properties: ["background-color", "font-weight"] },
				other:   { selector: seg(1), properties: ["background-color", "font-weight", "cursor"] },
				door:    { selector: ".steading-season-head .stonetop-section-door", properties: ["text-transform"] },
				body:    { selector: ".steading-season-head .stonetop-section-choose", properties: ["padding-top", "padding-left"] },
			},
		});
	});

	// The checked radio is what paints the segment; nothing else is tinted.
	it("tints the chosen season and only that one", () => {
		expect(v.get("current").get("background-color")).not.toBe("rgba(0, 0, 0, 0)");
		expect(v.get("other").get("background-color")).toBe("rgba(0, 0, 0, 0)");
		expect(Number(v.get("current").get("font-weight"))).toBeGreaterThan(Number(v.get("other").get("font-weight")));
	});

	it("marks every other season as something to click", () => {
		expect(v.get("other").get("cursor")).toBe("pointer");
	});

	// The character sheet's door, in the bar's label voice — not the sheet's default small caps.
	it("sets the door in the bar's own words", () => {
		expect(v.get("door").get("text-transform")).toBe("uppercase");
	});

	it("insets the section's body as the character sheet's are", () => {
		expect(v.get("body").get("padding-top")).toBe("8px");
		expect(v.get("body").get("padding-left")).toBe("12px");
	});
});
