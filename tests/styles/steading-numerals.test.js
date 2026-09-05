import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderPartial } from "../fakes/renderTemplate.js";

/**
 * What face a steading's numbers are actually set in.
 *
 * The sheet remaps `--font-primary` and `--font-serif` to the book's roman, which is right for every
 * word on it and wrong for the six numbers it exists to state: IM Fell English has old-style figures
 * and no lining set, so a rating's `0` sits at x-height and reads as a letter, and `-1` ahead of
 * "lacking" reads as an em dash.
 *
 * Text cannot answer this. Every `font-family` a rule inside `@layer system` declares on a value is
 * INERT — one unlayered `.window-content input { font-family: inherit }` beats all of them however
 * specific they are, which is why the values were rendering in the small-caps UI face on the line
 * and in the roman on the Play tab while the stylesheet said "IM Fell English" in both places. Only
 * a browser resolving the real cascade can say which rule won.
 *
 * The claim under test is a split, not a font: DIGITS change face, WORDS do not. So a rating's value
 * and its numeric notes are asserted to be in the numeral face, and its name, its tier gloss and
 * Size — a select holding a word, wearing the same value class — are asserted still to be in the
 * book's.
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

const rating = (title, current, note, noteKind) => ({
	title, shortTitle: title.slice(0, 4), isNumeric: true, current, note, noteKind,
});

const size = {
	title: "Size", shortTitle: "Size", isNumeric: false, current: "village",
	options: [{ value: "village", label: "village", selected: true }],
};

const tile = (attr, attrData) => renderPartial("stonetop.steading-stat-panel",
	{ attr, attrData, rollable: true, panelClass: `steading-${attr}` });

// Both densities, because the two are meant to be one component seen at two sizes — and each had
// its own family declaration to lose.
const fixture = `
<div class="application stonetop sheet actor steading themed theme-light" style="width: 1180px">
 <div class="window-content"><div class="sheet-wrapper">
  <header class="sheet-header steading-line" data-density="line">
   <div class="steading-line-row steading-line-values"><div class="steading-ledger">
    ${tile("prosperity", rating("Prosperity", 2, "→ +0 lacking", "adjustment"))}
    ${tile("population", rating("Population", 250, "150–350", "band"))}
    ${tile("defenses", rating("Defenses", 3, "legendary", "tier"))}
    ${tile("size", size)}
   </div></div>
  </header>
  <div class="steading-overview-grid" data-density="full">
   ${tile("prosperity", rating("Prosperity", 2, "→ +0 lacking", "adjustment"))}
  </div>
 </div></div>
</div>`;

const FAMILY = ["font-family"];
const LINE = ".steading-line .steading-tile";
const FULL = '[data-density="full"] .steading-tile';

describe.skipIf(!canProbe())("a steading's numbers", () => {
	let s;
	beforeAll(() => {
		s = probe.render({
			bodyHtml: fixture, bodyClass: "theme-light", rootAttrs: 'style="font-size: 16px"',
			probes: {
				lineValue: { selector: `${LINE}[data-attr="prosperity"] .steading-attr-input`, properties: FAMILY },
				fullValue: { selector: `${FULL}[data-attr="prosperity"] .steading-attr-input`, properties: FAMILY },
				adjustment: { selector: `${LINE} .steading-tile-note--adjustment`, properties: FAMILY },
				band:      { selector: `${LINE} .steading-tile-note--band`, properties: FAMILY },
				tier:      { selector: `${LINE} .steading-tile-note--tier`, properties: FAMILY },
				name:      { selector: `${LINE}[data-attr="prosperity"] .steading-stat-roll`, properties: FAMILY },
				size:      { selector: `${LINE} .steading-tile-select`, properties: FAMILY },
				sheet:     { selector: ".application.steading", properties: ["--font-numeral", "--font-serif"] },
			},
		});
	});

	const family = name => s.get(name).get("font-family");
	const numeral = () => s.get("sheet").get("--font-numeral").trim();

	it("declares a numeral face that is not the book's roman", () => {
		expect(numeral()).not.toBe("");
		expect(numeral()).not.toBe(s.get("sheet").get("--font-serif").trim());
	});

	// The two densities are one component; a split that only holds on one of them is not the split.
	it("sets a rating's value in it at both densities", () => {
		expect(family("lineValue"), "the ledger line's value is not in the numeral face").toBe(numeral());
		expect(family("fullValue"), "the Play tab's value is not in the numeral face").toBe(numeral());
	});

	// "→ +0 lacking" and "150–350" are numbers with a word attached; "legendary" is a word.
	it("sets the notes that are numbers in it, and leaves the one that is a word alone", () => {
		expect(family("adjustment")).toBe(numeral());
		expect(family("band")).toBe(numeral());
		expect(family("tier"), "a tier gloss left the book's voice").not.toBe(numeral());
	});

	it("leaves the words in the book's voice", () => {
		expect(family("name"), "a rating's name changed face with its value").not.toBe(numeral());
		// Size wears the value class but holds a word — and is the one value that is a <select>.
		expect(family("size"), "Size is a word and changed face with the numbers").not.toBe(numeral());
	});
});
