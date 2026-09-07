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
