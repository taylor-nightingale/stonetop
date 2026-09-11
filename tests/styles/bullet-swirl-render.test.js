import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// The swirl bullet is BOOK PROSE's marker. It belongs on a list of the book's sentences and nowhere
// else — not on a row of chips, not on a column of statement rows, not on a row of buttons.
//
// The rule that draws it used to name the single structural list it knew about
// (`ul:not(.stonetop-outfit-loads)`), so every structural list added after that one inherited a
// bullet. Each looked correct in isolation, because each declares `list-style: none; padding: 0` in
// its own rule — specificity (0,4,0) against the generic rule's (0,3,1). That combination is worse
// than doing nothing: it wins the GUTTER the swirl is absolutely positioned into (-1.1em) without
// touching `li::before`, so the marker still drew, now outside its own list. In the flex chip row
// each swirl landed on top of the chip to its left.
//
// Rendered rather than scanned, because the failure IS a specificity interaction between two rules
// that both look right on their own — text assertions passed throughout.

const STYLES = path.resolve("styles");
const sheet = (f) => path.join(STYLES, f);
const probe = new RenderProbe([
	sheet("themes/palette.css"), sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"), sheet("tokens.css"), sheet("stonetop.css"),
]);

// Every list that opts out, in the markup each ships in, plus the two that must keep their swirls.
const FIXTURE = `
<div class="application app stonetop sheet actor steading">
  <div class="window-content">
    <ul id="l-prose"><li>The book's own sentence.</li></ul>

    <ul id="l-chips" class="steading-effect-chips stonetop-unmarked">
      <li class="steading-effect-chip"><span>+1 Fortunes</span></li>
      <li class="steading-effect-chip"><span>+1 Surplus</span></li>
    </ul>

    <ul id="l-lines" class="steading-statement-lines stonetop-unmarked">
      <li class="steading-statement-line"><span class="steading-statement-clause">increase Fortunes by 1</span></li>
    </ul>

    <ul id="l-advisory" class="steading-statement-lines steading-statement-lines--advisory stonetop-unmarked">
      <li class="steading-statement-line"><span class="steading-statement-clause">add any new homes to the map</span></li>
    </ul>

    <ul id="l-moves" class="steading-statement-moves stonetop-unmarked">
      <li class="item stonetop-item" data-disclosure-row><div class="stonetop-item-header">News at the Inn</div></li>
    </ul>

    <ul id="l-loads" class="stonetop-outfit-loads stonetop-unmarked">
      <li><label class="stonetop-outfit-load-label">Light</label></li>
    </ul>
  </div>
</div>
<div class="stonetop-advice"><ul id="l-advice"><li>Advice, in the book's words.</li></ul></div>`;

const UNMARKED = ["chips", "lines", "advisory", "moves", "loads"];
const MARKED = ["prose", "advice"];

const PROBES = Object.fromEntries([
	...[...UNMARKED, ...MARKED].flatMap(name => [
		[`${name}-list`, { selector: `#l-${name}`, properties: ["padding-left", "list-style-type"] }],
		[`${name}-marker`, { selector: `#l-${name} > li`, pseudo: "::before",
			properties: ["content", "mask-image", "position"] }],
	]),
]);

describe.skipIf(!canProbe())("swirl bullets mark book prose and nothing else", () => {
	const seen = new Map();

	beforeAll(() => {
		for (const [k, v] of probe.render({ bodyHtml: FIXTURE, bodyClass: "game vtt theme-light", probes: PROBES }))
			seen.set(k, v);
	}, 120000);

	for (const name of UNMARKED) {
		it(`draws no marker on ${name}`, () => {
			const marker = seen.get(`${name}-marker`);
			expect(marker.missing, `${name}: no <li> in the fixture`).toBe(false);
			// `none` is the only value that means "this pseudo-element does not exist". An empty
			// string here would be a box that draws.
			expect(marker.get("content"), `${name}: a ::before marker still generates`).toBe("none");
		});

		it(`leaves no bullet gutter on ${name}`, () => {
			// The other half of the bug: the swirl hung -1.1em into a gutter that the list's own
			// `padding: 0` had already taken away. A marker-free list must have no gutter either,
			// or the fix is only half applied and the next rule re-opens it.
			expect(parseFloat(seen.get(`${name}-list`).get("padding-left")), `${name}: an indent for a marker it has not got`).toBe(0);
		});
	}

	for (const name of MARKED) {
		it(`still marks ${name} with the swirl`, () => {
			const marker = seen.get(`${name}-marker`);
			expect(marker.get("content"), `${name}: lost its bullet`).not.toBe("none");
			expect(marker.get("mask-image"), `${name}: bullet is not the swirl`).toContain("swirl.png");
			expect(marker.get("position")).toBe("absolute");
		});

		it(`indents ${name} to hold the swirl`, () => {
			// The marker is positioned into this gutter; without it the swirl sits outside the list.
			expect(parseFloat(seen.get(`${name}-list`).get("padding-left")), `${name}: no room for the marker`).toBeGreaterThan(0);
		});
	}
});

// WHERE a swirl lands, once a list has opted into one.
//
// The marker is absolutely positioned at `-(bullet + gap)` from its item, so the list's own left
// padding is the space it occupies — two halves of one decision, and the bug is what happens when a
// list makes only one of them. `.steading-statement-lines` zeroed its padding for the table shape of
// its rows, which every bulleted panel in the season box shares: the swirl of the step's own
// "what this adds" list was then drawn 16.5px left of the step's prose, out in the numeral's column,
// and two other panels carried a `padding-left` that did nothing but put the gutter back.
//
// Measured, not read: the gutter is an em of the LIST and the marker's offset an em of the ROW, so a
// stylesheet that declares the same calc() in both places can still land them 1.1px apart — which is
// exactly what it did while the list inherited core's 14px.
const STEP_FIXTURE = `
<div class="application app stonetop sheet actor steading" style="width: 640px">
 <div class="window-content">
  <section class="steading-season-box steading-block" data-season="autumn">
   <ol class="steading-turn-steps">
    <li class="steading-turn-step">
     <span class="steading-turn-num">4</span>
     <div class="steading-turn-body-step">
      <div class="steading-turn-text stonetop-rich" id="b-step">When the autumn harvest is complete, roll 1d4.</div>

      <div class="steading-turn-moment"><div class="steading-statement">
       <ul class="steading-statement-lines steading-statement-lines--advisory steading-statement-lines--sourced" id="b-contrib">
        <li class="steading-statement-line" id="b-contrib-row">
         <span class="steading-statement-source">Mill</span>
         <span class="steading-statement-clause">the steading generates +1 Surplus</span>
        </li>
       </ul>
      </div></div>

      <ul class="steading-effect-lines steading-statement-lines steading-statement-lines--sourced steading-turn-results" id="b-adj">
       <li class="steading-statement-line" id="b-adj-row">
        <span class="steading-statement-source">Township</span>
        <span class="steading-statement-clause">Consider Population to be 1 lower than it is.</span>
       </li>
      </ul>

      <div class="steading-turn-tiers stonetop-result-rows"><div class="stonetop-result-row">
       <div class="stonetop-result-body"><div class="steading-turn-outcomes"><div class="steading-statement">
        <ul class="steading-statement-lines steading-statement-lines--sourced" id="b-out">
         <li class="steading-statement-line" id="b-out-row">
          <span class="steading-statement-source">Raincatching</span>
          <span class="steading-statement-clause">the steading generates 1 Surplus</span>
          <button type="button" class="steading-statement-line-btn">Apply</button>
         </li>
        </ul>
       </div></div></div>
      </div></div>

     </div>
    </li>
   </ol>

   <div class="steading-payoff">
    <h4 class="steading-payoff-head">Henceforth:</h4>
    <ul class="steading-statement-lines" id="b-pay">
     <li class="steading-statement-line" id="b-pay-row">
      <span class="steading-statement-clause">increase Fortunes by 1</span>
     </li>
    </ul>
   </div>
  </section>
 </div>
</div>`;

// Every bulleted list in the season box: the step's own additions, the bends collected under it, the
// clauses waiting on a result row, and the improvement payoff's.
const BULLETED = ["contrib", "adj", "out", "pay"];

// The box each row's mark is drawn on — the cell holding its first line of text, never the row, whose
// height is the tallest thing in it. A row with an Apply is 24px tall and its text sits 1.5px below
// its own top, which a mark hung on the row does not follow.
const HOST = Object.fromEntries(BULLETED.map(n => [n, `#b-${n}-row > :first-child`]));

// The two that sit INSIDE a step, whose swirl reads as belonging to the step's own words: they share
// the column those words start from, which is what "set in from the step's line" means.
const IN_STEP = ["contrib", "adj"];

describe.skipIf(!canProbe())("a bulleted list's swirl lands in its own gutter", () => {
	const style = new Map();
	const box = new Map();

	beforeAll(() => {
		for (const [k, v] of probe.render({
			bodyHtml: STEP_FIXTURE, bodyClass: "game vtt theme-light",
			probes: Object.fromEntries([
				...BULLETED.map(n => [`${n}-marker`, { selector: HOST[n], pseudo: "::before",
					properties: ["content", "left", "top", "height"] }]),
				...BULLETED.map(n => [`${n}-row-marker`, { selector: `#b-${n}-row`, pseudo: "::before",
					properties: ["content"] }]),
				...BULLETED.map(n => [`${n}-list`, { selector: `#b-${n}`, properties: ["padding-left"] }]),
			]),
		})) style.set(k, v);

		for (const [k, v] of probe.measure({
			bodyHtml: STEP_FIXTURE, bodyClass: "game vtt theme-light",
			targets: Object.fromEntries([
				["step", "#b-step"],
				...BULLETED.map(n => [n, `#b-${n}-row`]),
				...BULLETED.map(n => [`${n}-host`, HOST[n]]),
			]),
		})) box.set(k, v);
	}, 120000);

	/** Viewport x of the swirl's left edge: its offset is from the box it is drawn on. */
	const bulletLeft = name =>
		box.get(`${name}-host`).values.boxLeft + parseFloat(style.get(`${name}-marker`).get("left"));

	/** Viewport y of the swirl's centre. */
	const bulletMiddle = name => {
		const marker = style.get(`${name}-marker`);
		return box.get(`${name}-host`).values.boxTop + parseFloat(marker.get("top"))
			+ parseFloat(marker.get("height")) / 2;
	};

	for (const name of BULLETED) {
		it(`draws ${name}'s marker inside the gutter the list holds`, () => {
			const marker = style.get(`${name}-marker`);
			expect(marker.get("content"), `${name}: lost its swirl`).not.toBe("none");

			// The one invariant: what the list reserves is what the marker takes. Off by 16.5px it is
			// in the column to the left of the list; off by 1.1px it is a hair outside its own words.
			const gutter = parseFloat(style.get(`${name}-list`).get("padding-left"));
			expect(Math.abs(parseFloat(marker.get("left"))), `${name}: marker offset is not the list's gutter`)
				.toBeCloseTo(gutter, 1);
		});
	}

	for (const name of IN_STEP) {
		it(`lands ${name}'s swirl on the step's own text column`, () => {
			expect(bulletLeft(name), `${name}: swirl is not on the column the step's words start from`)
				.toBeCloseTo(box.get("step").textLeft, 0);
		});
	}

	for (const name of BULLETED) {
		it(`centres ${name}'s swirl on its row's first line of text`, () => {
			// `out` is the case that failed: its row carries an Apply, so the row is the button's 24px
			// and baseline alignment drops the row's text 1.5px to the control's baseline. A mark
			// measured from the row's top stayed on a line the text had left.
			expect(bulletMiddle(name), `${name}: swirl is off the line it marks`)
				.toBeCloseTo(box.get(name).firstLineMiddle, 0);
		});

		it(`draws ${name}'s mark once`, () => {
			// Hung on the cell, the row must not draw one of its own: two swirls, one of them on the
			// control's box rather than the text's.
			expect(style.get(`${name}-row-marker`).get("content"), `${name}: the row marks itself too`)
				.toBe("none");
		});
	}

	it("reads the two lists inside a step as one column", () => {
		// They are adjacent panels of the same step — the additions and the bends — and a reader sees
		// one list of clauses. Their swirls used to sit 15.4px apart.
		expect(bulletLeft("contrib")).toBeCloseTo(bulletLeft("adj"), 1);
	});
});
