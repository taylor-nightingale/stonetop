import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// A rating heads its list as the bar (steading-ratings-list.hbs), and its value is the one control
// drawn ON the stone rather than hanging below it. The stone fades out toward the far end and the
// panel shows through its texture in flecks the size of the ink's own glyphs, so the note, the value
// and its carets each sit on a cleared patch of the bar's fill. A bar with no value keeps its stone.

const STYLES = path.resolve(process.cwd(), "styles");
const probe = new RenderProbe(["themes/palette.css", "themes/parchment-light.css", "themes/parchment-dark.css", "tokens.css", "stonetop.css"]
	.map(f => path.join(STYLES, f)));

const ratingBar = `<header class="stonetop-bar">
	<button type="button" class="stonetop-bar-title stonetop-bar-roll rollable">Prosperity</button>
	<span class="stonetop-bar-note steading-bar-note--debility">→ −1 lacking</span>
	<span class="stonetop-bar-meta"><span class="stonetop-stepper">
		<input type="number" class="stonetop-step steading-attr-input" value="0">
		<button type="button" class="stonetop-stepper-btn stonetop-stepper-btn--up">▲</button>
		<button type="button" class="stonetop-stepper-btn stonetop-stepper-btn--down">▼</button>
	</span></span></header>`;

const plainBar = `<header class="stonetop-bar"><span class="stonetop-bar-title">Excluded Content</span>
	<span class="stonetop-bar-note">Not part of the game</span><span class="stonetop-bar-meta"></span></header>`;

const sheet = theme => `
<div class="application stonetop sheet actor steading theme-${theme}" id="${theme}">
	<section class="stonetop-panel steading-overview-field" id="${theme}-rating">${ratingBar}</section>
	<section class="stonetop-panel" id="${theme}-plain">${plainBar}</section>
	<span id="${theme}-fill" style="background-color: var(--st-chip-fill)">x</span>
</div>`;

const PROBES = Object.fromEntries(["light", "dark"].flatMap(theme => [
	[`${theme}Fill`,      { selector: `#${theme}-fill`, properties: ["background-color"] }],
	[`${theme}Stepper`,   { selector: `#${theme}-rating .stonetop-stepper`, properties: ["background-color", "box-shadow"] }],
	[`${theme}Note`,      { selector: `#${theme}-rating .stonetop-bar-note`, properties: ["background-color", "box-shadow"] }],
	[`${theme}Caret`,     { selector: `#${theme}-rating .stonetop-stepper-btn--up`, properties: ["opacity", "text-shadow"] }],
	[`${theme}PlainNote`, { selector: `#${theme}-plain .stonetop-bar-note`, properties: ["background-color"] }],
]));

describe.skipIf(!canProbe())("a rating's bar", () => {
	let probed;
	beforeAll(() => {
		probed = probe.render({ bodyHtml: sheet("light") + sheet("dark"), bodyClass: "theme-light", rootAttrs: 'style="font-size: 16px"', probes: PROBES });
	});
	const css = (name, prop) => probed.get(name).get(prop);

	describe.each(["light", "dark"])("in the %s theme", theme => {
		it("sets the value on the bar's own fill, feathered into the stone", () => {
			expect(css(`${theme}Stepper`, "background-color")).toBe(css(`${theme}Fill`, "background-color"));
			expect(css(`${theme}Stepper`, "box-shadow")).toContain(css(`${theme}Fill`, "background-color"));
		});

		it("sets the note on the bar's own fill, feathered into the stone", () => {
			expect(css(`${theme}Note`, "background-color")).toBe(css(`${theme}Fill`, "background-color"));
			expect(css(`${theme}Note`, "box-shadow")).toContain(css(`${theme}Fill`, "background-color"));
		});

		it("draws the carets at full ink, haloed like the number", () => {
			expect(css(`${theme}Caret`, "opacity")).toBe("1");
			expect(css(`${theme}Caret`, "text-shadow")).toContain(css(`${theme}Fill`, "background-color"));
		});

		it("leaves a bar with no value on its stone", () => {
			expect(css(`${theme}PlainNote`, "background-color")).toBe("rgba(0, 0, 0, 0)");
		});
	});
});
