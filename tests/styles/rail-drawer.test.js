import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

/**
 * The steading's rail, which is now the character's: a small tab riding the rail's edge, the rail
 * sliding out whole under the tab column rather than folding to a strip, and a drawer over the tab
 * below the breakpoint. Nothing in the column beside it moves for the tab — it sits in the column's
 * inset. Geometry, because none of it can be read off the stylesheet.
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

// Font Awesome's own rule, unlayered, exactly as the app serves it; the width stands in for the glyph
// the icon font would draw.
const FONT_AWESOME = `<style>.fas { display: inline-block; width: 1em; height: 1em; }</style>`;

const fixture = ({ state = "", width }) => `
${FONT_AWESOME}
<div class="application stonetop sheet actor steading themed theme-light" style="width: ${width}px">
  <div class="window-content"><div class="sheet-wrapper">
   <div class="stonetop-rail-layout ${state}" style="height: 600px">
    <button type="button" class="stonetop-rail-toggle" data-action="toggleRail" aria-expanded="true" aria-label="Rail">
      <i class="fas fa-chevron-left stonetop-rail-caret" aria-hidden="true"></i>
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
	layout:   ".stonetop-rail-layout",
	toggle:   ".stonetop-rail-toggle",
	rail:     ".stonetop-rail",
	archpair: ".steading-archpair",
	main:     ".stonetop-rail-main",
	tab:      ".stonetop-rail-main .tab",
};

const REM = 16;
const right = v => v.boxLeft + v.boxWidth;
const overlaps = (a, b) =>
	a.boxLeft < right(b) && b.boxLeft < right(a) &&
	a.boxTop  < b.boxTop + b.boxHeight && b.boxTop < a.boxTop + a.boxHeight;

const measure = opts => probe.measure({
	bodyHtml: fixture(opts), bodyClass: "theme-light",
	rootAttrs: 'style="font-size: 16px"', targets: TARGETS,
	chromeFlags: [`--window-size=${opts.width + 40},900`],
});

describe.skipIf(!canProbe())("the steading's rail, as the character's", () => {
	let open, shut, drawer, drawerOpen;
	const v = (m, name) => m.get(name).values;
	beforeAll(() => {
		open = measure({ width: 1400 });
		shut = measure({ state: "rail-shut", width: 1400 });
		drawer = measure({ width: 760 });
		drawerOpen = measure({ state: "rail-open", width: 760 });
	});

	it("renders", () => {
		for (const m of [open, shut, drawer, drawerOpen]) for (const [name, el] of m) expect(el.missing, name).toBe(false);
	});

	it("is a small tab, not a pill or a strip", () => {
		for (const m of [open, shut, drawer]) {
			expect(v(m, "toggle").boxWidth).toBeCloseTo(0.85 * REM, 0);
			expect(v(m, "toggle").boxHeight).toBeCloseTo(2 * REM, 0);
		}
	});

	it("rides the open rail's edge, over none of the rail's contents or the tab's", () => {
		expect(v(open, "toggle").boxLeft).toBeCloseTo(right(v(open, "rail")), 0);
		expect(overlaps(v(open, "toggle"), v(open, "archpair"))).toBe(false);
		expect(right(v(open, "toggle"))).toBeLessThanOrEqual(v(open, "tab").boxLeft);
	});

	it("starts the column at the rail's edge, with no gap beside it", () => {
		expect(v(open, "main").boxLeft).toBeCloseTo(right(v(open, "rail")), 0);
	});

	it("slides a shut rail out whole, the tab with it to the sheet's edge, and gives the column its width", () => {
		expect(v(shut, "rail").boxWidth).toBeCloseTo(v(open, "rail").boxWidth, 0);
		expect(right(v(shut, "rail"))).toBeLessThanOrEqual(v(shut, "layout").boxLeft + 0.5);
		expect(v(shut, "toggle").boxLeft).toBeCloseTo(v(shut, "layout").boxLeft, 0);
		expect(v(shut, "main").boxLeft).toBeCloseTo(v(shut, "layout").boxLeft, 0);
		expect(right(v(shut, "toggle"))).toBeLessThanOrEqual(v(shut, "tab").boxLeft);
	});

	it("rides a drawer's edge the same way below the breakpoint, and moves nothing in the column", () => {
		expect(v(drawer, "toggle").boxLeft).toBeCloseTo(v(drawer, "layout").boxLeft, 0);
		expect(v(drawerOpen, "toggle").boxLeft).toBeCloseTo(right(v(drawerOpen, "rail")), 0);
		expect(v(drawerOpen, "rail").boxLeft).toBeLessThanOrEqual(v(drawerOpen, "main").boxLeft + 1);
		expect(v(drawerOpen, "tab").boxLeft).toBeCloseTo(v(drawer, "tab").boxLeft, 0);
	});

	it("gives the rail's first row the top of the rail", () => {
		expect(v(open, "archpair").boxTop - v(open, "rail").boxTop).toBeLessThan(16);
	});

	// SC 2.5.8: drawn narrow, pressed across 24px of the column's inset.
	it("is 24px across to the pointer", () => {
		const m = probe.render({
			bodyHtml: fixture({ width: 1400 }), bodyClass: "theme-light", rootAttrs: 'style="font-size: 16px"',
			chromeFlags: ["--window-size=1440,900"],
			probes: { target: { selector: ".stonetop-rail-toggle", pseudo: "::after", properties: ["width"] } },
		});
		expect(parseFloat(m.get("target").get("width"))).toBeGreaterThanOrEqual(24);
	});

	// Off screen is not gone: a shut rail's controls would still take the focus.
	it("takes a shut rail out of the tab order", () => {
		const m = probe.render({
			bodyHtml: fixture({ state: "rail-shut", width: 1400 }), bodyClass: "theme-light", rootAttrs: 'style="font-size: 16px"',
			chromeFlags: ["--window-size=1440,900", "--force-prefers-reduced-motion"],
			probes: { rail: { selector: ".stonetop-rail", properties: ["visibility"] } },
		});
		expect(m.get("rail").get("visibility")).toBe("hidden");
	});
});

/**
 * The character sheet's rail runs the WHOLE sheet, not just the tab.
 *
 * It used to hang inside `.sheet-main`, below the masthead and a ~400px stats band, so it could only
 * ever be as tall as the current tab — the thing it is for (the numbers you roll and the moves you
 * roll them on) sat in a column that started halfway down the window. Hoisting the layout to be the
 * wrapper's own child is what fixes that, and only layout can say whether it worked: every rule in
 * the chain is as valid pointing at the wrong ancestor as at the right one.
 */
const FULL_HEIGHT_TARGETS = {
	rail:     ".stonetop-rail",
	masthead: ".character-main > .sheet-header",
	body:     ".character-main > .sheet-body",
};

const fullHeightFixture = `
${FONT_AWESOME}
<div class="application stonetop sheet character themed theme-light" style="width: 1100px; height: 700px">
  <div class="window-content"><div class="sheet-wrapper">
    <div class="stonetop-rail-layout">
      <button type="button" class="stonetop-rail-toggle" aria-label="Rail">
        <i class="fas fa-chevron-left stonetop-rail-caret" aria-hidden="true"></i>
      </button>
      <div class="stonetop-rail stonetop-moves-rail"><button type="button">Roll</button></div>
      <div class="stonetop-rail-main character-main">
        <header class="sheet-header flexrow"><div class="header-fields"><h1 class="charname">
          <input name="name" type="text" value="Blodwen" aria-label="Name">
        </h1></div></header>
        <nav class="sheet-tabs tabs" data-group="primary"><button type="button" class="item">Moves</button></nav>
        <section class="sheet-body">
          <div class="tab active" data-tab="moves" style="height: 3000px">a tab long enough to scroll</div>
        </section>
      </div>
    </div>
  </div></div>
</div>`;

describe.skipIf(!canProbe())("the character rail spans the whole sheet", () => {
	const m = () => probe.measure({
		bodyHtml: fullHeightFixture, bodyClass: "game themed theme-light",
		rootAttrs: 'style="font-size: 16px"', targets: FULL_HEIGHT_TARGETS,
		chromeFlags: ["--window-size=1160,800"],
	});

	it("opens level with the masthead rather than below it", () => {
		const r = m();
		const rail = r.get("rail").values;
		const masthead = r.get("masthead").values;
		expect(rail.boxHeight, "the rail is not drawn at this width").toBeGreaterThan(0);
		expect(rail.boxTop, `rail starts at ${Math.round(rail.boxTop)}, masthead at ${Math.round(masthead.boxTop)}`)
			.toBeLessThanOrEqual(masthead.boxTop + 1);
	});

	it("runs past the tab rule to the foot of the sheet", () => {
		const r = m();
		const rail = r.get("rail").values;
		const body = r.get("body").values;
		expect(rail.boxTop + rail.boxHeight)
			.toBeGreaterThanOrEqual(body.boxTop + body.boxHeight - 1);
	});

	// The masthead is beside the rail, not above it: that is what "the layout is the outer container"
	// buys, and it is the half a `height: 100%` on the rail could never give.
	it("puts the masthead beside the rail, not over it", () => {
		const r = m();
		const rail = r.get("rail").values;
		const masthead = r.get("masthead").values;
		expect(masthead.boxLeft).toBeGreaterThanOrEqual(rail.boxLeft + rail.boxWidth - 1);
	});
});
