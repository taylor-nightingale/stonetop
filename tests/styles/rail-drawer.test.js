import { describe, it, expect } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

/**
 * The rail, as a drawer.
 *
 * Below the layout's breakpoint the rail slides over the tab behind a toggle. Three things have to
 * be true of that, and none of them can be read off the stylesheet:
 *
 *  1. The toggle and the rail it opens never share a pixel. The button no longer buys that with a
 *     reserved strip of padding — it sits out in the empty channel beside the rail — so what has to
 *     hold is the plain geometric fact, at both widths and in both states. The vertical stacking
 *     these tests used to assert would now be WRONG: the two are meant to sit side by side.
 *  2. The two sides mirror. `data-side` is the only thing that says which edge, so a rule written
 *     for one side and not the other shows up as a drawer that slides in from the wrong place.
 *  3. The toggle clears the SC 2.5.8 target-size floor of 24px.
 *  4. A shut rail leaves a marked strip, and the tab steps aside for it. Both are the whole point of
 *     the collapsed state — a lone glyph in a corner said nothing, and a strip the tab runs under
 *     hides the first characters of every line — and neither can be read off the stylesheet:
 *     `display: var(--rail-toggle-fold)` is as valid with the wrong value as with the right one, and
 *     whether a padding clears an absolutely positioned box is a question only layout answers.
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

// Font Awesome's own rule, unlayered, exactly as the app serves it — and every rule in stonetop.css
// is inside `@layer system`, which an unlayered declaration beats at any specificity. Without this
// here, an icon the strip alone should show is hidden in the fixture and drawn in Foundry.
// The `width`/`height` stand in for the glyph the icon font would draw — the font itself is not
// loaded here, and an empty <i> measures 0 either way, which no display rule could be caught by.
const FONT_AWESOME = `<style>.fas { display: inline-block; width: 1em; height: 1em; }</style>`;

const fixture = ({ side, open, shut = false, width }) => `
${FONT_AWESOME}
<div class="application stonetop sheet actor steading themed theme-light" style="width: ${width}px">
  <div class="window-content"><div class="sheet-wrapper">
   <div class="stonetop-rail-layout${open ? " rail-open" : ""}${shut ? " rail-shut" : ""}" data-side="${side}" style="height: 600px">
    <button type="button" class="stonetop-rail-toggle" data-action="toggleRail" aria-expanded="${open}" aria-label="Rail">
      <i class="fas fa-chevron-left stonetop-rail-caret" aria-hidden="true"></i>
      <span class="stonetop-rail-fold" aria-hidden="true">
        <i class="fas fa-archway stonetop-rail-mark"></i>
        <i class="fas fa-dice-d6 stonetop-rail-mark"></i>
      </span>
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
	mark:    ".stonetop-rail-mark",
	tab:     ".stonetop-rail-main .tab",
};

/** Do two measured boxes share any pixel? The toggle's one hard rule, in the only terms it holds. */
const overlaps = (a, b) =>
	a.boxLeft < b.boxLeft + b.boxWidth && b.boxLeft < a.boxLeft + a.boxWidth &&
	a.boxTop  < b.boxTop  + b.boxHeight && b.boxTop  < a.boxTop  + a.boxHeight;

const rect = v => `${Math.round(v.boxLeft)},${Math.round(v.boxTop)} ${Math.round(v.boxWidth)}x${Math.round(v.boxHeight)}`;

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
			expect(overlaps(toggle, arch), `toggle ${rect(toggle)} covers the arches ${rect(arch)}`).toBe(false);
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

	// The rail is the reader's to put away at any width — "only when your window is small" was a rule
	// about the window rather than about the reader.
	it("offers the toggle while the rail is an inline column too", () => {
		const toggle = measure({ side: "left", open: false, width: 1400 }).get("toggle").values;
		expect(toggle.boxWidth).toBeGreaterThanOrEqual(24);
		expect(toggle.boxHeight).toBeGreaterThanOrEqual(24);
	});

	// Inline, the toggle rides the rail's inner edge. Same rule as the drawer's, at the other width.
	it("does not put an inline rail's first row under its toggle", () => {
		const r = measure({ side: "left", open: false, width: 1400 });
		const toggle = r.get("toggle").values;
		const arch = r.get("archpair").values;
		expect(overlaps(toggle, arch), `toggle ${rect(toggle)} covers the arches ${rect(arch)}`).toBe(false);
	});

	// What buys that: the channel between the rail's content and the tab's — the rail's own padding,
	// its rule and the layout's gap — which is empty at every height. A toggle anywhere else is
	// either over the arches or over the tab, and the rail pays for it in reserved space.
	it("puts an open rail's toggle in the empty channel between the rail and the tab", () => {
		const r = measure({ side: "left", open: false, width: 1400 });
		const toggle = r.get("toggle").values;
		const arch = r.get("archpair").values;
		const main = r.get("main").values;
		expect(toggle.boxLeft, "the toggle starts before the arches end").toBeGreaterThanOrEqual(arch.boxLeft + arch.boxWidth);
		expect(toggle.boxLeft + toggle.boxWidth, "the toggle runs past the channel, over the tab").toBeLessThanOrEqual(main.boxLeft);
	});

	// The arches start at the TOP of the rail now: nothing is reserved above them, which is the space
	// the old corner button cost. Measured against the rail rather than in px, so the type scale can
	// move without this becoming a lie.
	it("gives the rail's first row the top of the rail", () => {
		const r = measure({ side: "left", open: false, width: 1400 });
		const rail = r.get("rail").values;
		const arch = r.get("archpair").values;
		expect(arch.boxTop - rail.boxTop, "empty rail above the arches").toBeLessThan(16);
	});

	// A shut rail is not nothing: it is the rail folded against the edge, wearing the marks its own
	// contents wear. A strip showing nothing is the lone glyph in a corner this replaced.
	it("leaves a marked strip at the edge when the rail is shut", () => {
		const r = measure({ side: "left", open: false, shut: true, width: 1400 });
		const toggle = r.get("toggle").values;
		const mark = r.get("mark").values;
		const main = r.get("main").values;
		expect(toggle.boxLeft, "the strip is not on the rail's edge").toBeLessThanOrEqual(main.boxLeft);
		expect(toggle.boxHeight, "the strip does not run the sheet's height").toBeGreaterThan(300);
		expect(mark.boxWidth, "the rail's mark is not drawn on the strip").toBeGreaterThan(0);
		// Beside the caret, not at the far end of however tall the sheet is.
		expect(mark.boxTop, "the marks drift down the strip")
			.toBeLessThan(toggle.boxTop + toggle.boxHeight / 2);
	});

	// The bug this cost a round of review: the strip is positioned, so the tab ran clean underneath
	// it and every line in the Play tab lost its first characters. A gutter on the three controls
	// that used to share a corner with a 26px button cannot see that; the region has to step aside.
	it("steps the whole tab aside for the strip rather than letting it run underneath", () => {
		const r = measure({ side: "left", open: false, shut: true, width: 1400 });
		const toggle = r.get("toggle").values;
		expect(r.get("tab").textLeft ?? r.get("tab").values.contentLeft, "the tab's text starts under the strip")
			.toBeGreaterThanOrEqual(toggle.boxLeft + toggle.boxWidth);
	});

	it("mirrors: on the right the strip folds against the right edge", () => {
		const r = measure({ side: "right", open: false, shut: true, width: 1400 });
		const toggle = r.get("toggle").values;
		const main = r.get("main").values;
		const tab = r.get("tab").values;
		expect(toggle.boxLeft + toggle.boxWidth).toBeGreaterThanOrEqual(main.boxLeft + main.boxWidth - 1);
		expect(r.get("mark").values.boxWidth).toBeGreaterThan(0);
		expect(tab.boxLeft + tab.boxWidth, "the tab runs under the strip").toBeLessThanOrEqual(toggle.boxLeft);
	});

	// Untouched at a drawer's width the rail is shut, so that is the state the strip has to appear in
	// — the one no class in the markup says anything about.
	it("folds to the strip at a narrow width with nothing said either way", () => {
		const r = measure({ side: "left", open: false, width: 760 });
		expect(r.get("toggle").values.boxHeight).toBeGreaterThan(300);
		expect(r.get("mark").values.boxWidth).toBeGreaterThan(0);
	});

	// Open, the rail is there to be looked at; marks for its contents would name a second time what
	// is already on screen, in the one state where the button has to stay small.
	it("drops the marks once the rail is open", () => {
		const r = measure({ side: "left", open: false, width: 1400 });
		expect(r.get("mark").values.boxWidth, "a mark is still drawn in the pill").toBe(0);
		expect(r.get("toggle").values.boxHeight).toBeLessThan(40);
	});

	// Put away above the breakpoint the rail is GONE, not slid off-screen: the whole point is the tab
	// getting the width back.
	it("takes the rail out of the layout when it is shut at a wide width", () => {
		const r = measure({ side: "left", open: false, shut: true, width: 1400 });
		expect(r.get("rail").values.boxWidth).toBe(0);
		expect(r.get("main").values.boxLeft).toBeLessThan(60);
	});

	// Shut, the strip is at the sheet's own edge and the region beside the rail begins after it —
	// they sit side by side rather than one over the other. This used to assert the opposite (the
	// region running under the strip, with only its text stepping aside), which is the geometry that
	// hid a scrolling tab's scrollbar; see the scrollbar tests below.
	it("keeps the toggle reachable and clear of the tab when the rail is shut", () => {
		const r = measure({ side: "left", open: false, shut: true, width: 1400 });
		const toggle = r.get("toggle").values;
		const main = r.get("main").values;
		expect(toggle.boxWidth).toBeGreaterThanOrEqual(24);
		expect(toggle.boxLeft, "the strip is not at the sheet's edge").toBeLessThanOrEqual(main.boxLeft);
		expect(overlaps(toggle, main), `the strip ${rect(toggle)} is over the tab ${rect(main)}`).toBe(false);
	});
});

/**
 * The region beside the rail, when that region is itself the scrolling box.
 *
 * On the character sheet `.sheet-body` and `.stonetop-rail-main` are ONE element, so what steps
 * aside for the folded strip is the scroll container. A padding could not do it: padding moves the
 * content and leaves the border box where it was, and a scrollbar is drawn at the BORDER edge — so
 * the tab's text cleared the strip while the scrollbar it needs sat underneath it, and putting the
 * rail away took the scrollbar away with it.
 *
 * Geometry, because that is the whole of the claim: no computed value distinguishes a gutter that
 * moves the box from one that moves only what is in it.
 */
const SCROLLER_TARGETS = { toggle: ".stonetop-rail-toggle", body: ".stonetop-rail-main" };

// Markup copied from character.hbs: the rail layout with its body and rail as siblings, the body
// carrying both classes. The tall child is what makes it actually scroll.
const scrollingFixture = ({ shut, width }) => `
${FONT_AWESOME}
<div class="application stonetop sheet character themed theme-light" style="width: ${width}px; height: 700px">
  <div class="window-content"><div class="sheet-wrapper"><section class="sheet-main flexcol">
    <nav class="sheet-tabs tabs" data-group="primary"><button type="button" class="item">Moves</button></nav>
    <div class="stonetop-rail-layout${shut ? " rail-shut" : ""}" data-side="right">
      <button type="button" class="stonetop-rail-toggle" aria-label="Rail">
        <i class="fas fa-chevron-left stonetop-rail-caret" aria-hidden="true"></i>
        <span class="stonetop-rail-fold" aria-hidden="true"><i class="fas fa-bolt stonetop-rail-mark"></i></span>
      </button>
      <section class="sheet-body stonetop-rail-main">
        <div class="tab active" data-tab="moves" style="height: 3000px">a tab long enough to scroll</div>
      </section>
      <div class="stonetop-rail stonetop-moves-rail"><button type="button">Roll</button></div>
    </div>
  </section></div></div>
</div>`;

const measureScroller = opts => probe.measure({
	bodyHtml: scrollingFixture(opts), bodyClass: "game themed theme-light",
	rootAttrs: 'style="font-size: 16px"', targets: SCROLLER_TARGETS,
	chromeFlags: [`--window-size=${opts.width + 50},800`],
});

describe.skipIf(!canProbe())("a shut rail and the tab's scrollbar", () => {
	// The regression: the scrolling box ran the full width of the layout, so its track was under the
	// strip and a reader who put the rail away lost the scrollbar entirely.
	it("ends the scrolling region before the strip when the rail is shut", () => {
		const r = measureScroller({ shut: true, width: 1400 });
		const toggle = r.get("toggle").values;
		const body = r.get("body").values;
		expect(body.boxLeft + body.boxWidth, "the scrolling box runs under the strip, taking its scrollbar with it")
			.toBeLessThanOrEqual(toggle.boxLeft);
	});

	// Below the breakpoint an untouched rail is already a shut drawer, so the strip — and the same
	// fault — is there with no class in the markup saying anything about it.
	it("ends it before the strip at a drawer's width too", () => {
		const r = measureScroller({ shut: false, width: 760 });
		const toggle = r.get("toggle").values;
		const body = r.get("body").values;
		expect(toggle.boxHeight, "no strip at this width").toBeGreaterThan(300);
		expect(body.boxLeft + body.boxWidth).toBeLessThanOrEqual(toggle.boxLeft);
	});

	// Open and inline, the toggle is a pill out in the channel beyond the region, so the region keeps
	// the full width it is given — the gutter is spent only where a strip is actually standing.
	it("gives the region its whole width back while the rail is open", () => {
		const r = measureScroller({ shut: false, width: 1400 });
		const toggle = r.get("toggle").values;
		const body = r.get("body").values;
		expect(toggle.boxHeight, "the toggle is not the open pill").toBeLessThan(40);
		expect(body.boxLeft + body.boxWidth, "the region is paying for a strip that is not there")
			.toBeLessThanOrEqual(toggle.boxLeft);
	});
});
