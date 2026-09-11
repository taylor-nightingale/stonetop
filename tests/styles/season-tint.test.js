import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

/**
 * The season tint, as Chrome actually resolves it.
 *
 * `data-season` sits on `.sheet-wrapper` and the band that consumes it is a child, so the whole
 * mechanism is one inherited custom property crossing two elements through a `var()` with a
 * fallback. Text cannot answer whether that arrives: a fallback is what a broken var() looks like,
 * and `background: linear-gradient(…, var(--steading-season-tint, var(--st-accent)), …)` reads as
 * correct either way. If the token never resolved, every season would silently render as the
 * sheet's sepia accent and every text-based assertion would still pass.
 *
 * The wheel's current segment is the same question with teeth: it paints the tint as a BACKGROUND
 * behind text, so a season that failed to resolve would put ink on ink.
 *
 * Both parchments, because the wheel's foreground and its tint are declared in different theme
 * files: a pairing that works on one ground says nothing about the other.
 *
 * Every case is in ONE fixture per theme. A probe per season is four browser starts to answer one
 * question, and the suite pays for it every run.
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

const SEASONS = ["spring", "summer", "autumn", "winter"];
// A season with no tint declared — what the band falls back to, and the shape a token that never
// resolved would take for ALL of them.
const UNKNOWN = "harvestide";

const block = season => `
  <div class="sheet-wrapper" data-season="${season}" id="w-${season}">
    <div class="steading-season-band" aria-hidden="true"></div>
    <ol class="steading-wheel">
      <li class="steading-wheel-season">Spring</li>
      <li class="steading-wheel-season is-current">Current</li>
    </ol>
    <p class="steading-season-line">
      <span class="steading-season-mark" aria-hidden="true"></span>
      Autumn, year 1
    </p>
    <div class="steading-tile steading-fortunes steading-tile--arched">
      <span class="steading-arch" id="a-${season}" aria-hidden="true">
        <img class="steading-tile-badge" alt="">
      </span>
    </div>
  </div>`;

const fixture = theme => `
<div class="application stonetop sheet actor steading themed ${theme}">
  <div class="window-content">
    ${[...SEASONS, UNKNOWN].map(block).join("\n")}
  </div>
</div>`;

const probesFor = season => ({
	[`${season}-band`]:    { selector: `#w-${season} .steading-season-band`, properties: ["background-image", "height"] },
	[`${season}-current`]: { selector: `#w-${season} .steading-wheel-season.is-current`, properties: ["background-color", "color"] },
	[`${season}-line`]:    { selector: `#w-${season} .steading-season-line`, properties: ["color"] },
	[`${season}-mark`]:    { selector: `#w-${season} .steading-season-mark`, properties: ["background-color", "mask-image", "width"] },
	[`${season}-arch`]:    { selector: `#a-${season}`, properties: ["background-color", "mask-image"] },
});

// rgb(...) → [r,g,b]
const rgb = value => (value.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);

const describeMaybe = canProbe() ? describe : describe.skip;

const THEMES = ["theme-light", "theme-dark"];

describeMaybe("the season tint, in a real renderer", () => {
	const rendered = new Map();

	beforeAll(() => {
		for (const theme of THEMES) {
			rendered.set(theme, probe.render({
				bodyHtml:  fixture(theme),
				bodyClass: theme,
				probes:    Object.assign({}, ...[...SEASONS, UNKNOWN].map(probesFor)),
			}));
		}
	}, 120000);

	const result = () => rendered.get("theme-dark");
	const bandOf = season => result().get(`${season}-band`).get("background-image");

	it("resolves a different tint for every season", () => {
		expect(new Set(SEASONS.map(bandOf)).size).toBe(4);
	});

	// The failure this file exists for: a token that never resolved falls back to the sheet accent,
	// and all four seasons render identically while the stylesheet still reads as correct.
	it("does not fall back to the sheet accent", () => {
		for (const season of SEASONS) expect(bandOf(season)).not.toBe(bandOf(UNKNOWN));
	});

	// …and the fallback itself still has to work, for a season this sheet has no colour for.
	it("still paints a band for a season it has no tint for", () => {
		expect(bandOf(UNKNOWN)).toContain("gradient");
	});

	it("draws the band as a visible rule, not a collapsed one", () => {
		expect(parseFloat(result().get("autumn-band").get("height"))).toBeGreaterThan(0);
	});

	// The current segment paints the tint BEHIND text. Ink on ink is what an unresolved token looks
	// like here, so the two have to be far apart in luminance — and at the ordinary body-text floor
	// (WCAG 1.4.3, 4.5:1), not the 3:1 one for large text: a wheel segment is neither large nor bold.
	it("keeps the wheel's current season readable on its own tint, on both parchments", () => {
		for (const theme of THEMES) {
			for (const season of SEASONS) {
				const seg = rendered.get(theme).get(`${season}-current`);
				const ratio = contrast(rgb(seg.get("background-color")), rgb(seg.get("color")));
				expect(ratio, `${theme} ${season}`).toBeGreaterThanOrEqual(4.5);
			}
		}
	});

	// The glyph beside those words is masked to the same tint, and the mask itself is a second token
	// crossing the same two elements — an unresolved one leaves a tinted square, which reads as a
	// rendering fault rather than as a season.
	it("marks the season with its own glyph, tinted per season", () => {
		const marks = SEASONS.map(season => result().get(`${season}-mark`));
		for (const [i, mark] of marks.entries()) {
			expect(mark.missing, SEASONS[i]).toBe(false);
			expect(mark.get("mask-image"), SEASONS[i]).not.toBe("none");
			expect(parseFloat(mark.get("width")), SEASONS[i]).toBeGreaterThan(0);
		}
		expect(new Set(marks.map(m => m.get("background-color"))).size).toBe(4);
	});

	// The arch is the largest thing on the sheet carrying the season's colour, and it carries it the
	// hard way: a flat fill cut to the woodcut's alpha. TWO things can silently fail there and both
	// look plausible — an unresolved tint paints every season in the sheet accent, and an unresolved
	// mask (the art path comes from the template, not this stylesheet) leaves a solid square where
	// the arch was — and that is what it did, because the path was being handed in on the element and
	// a relative url() in a custom property resolves against the stylesheet that USES it. Neither is
	// visible to a text reading of the CSS.
	it("cuts the season's tint to the arch, in every season", () => {
		const arches = SEASONS.map(season => result().get(`${season}-arch`));
		for (const [i, arch] of arches.entries()) {
			expect(arch.missing, SEASONS[i]).toBe(false);
			expect(arch.get("mask-image"), SEASONS[i]).not.toBe("none");
			expect(arch.get("background-color"), SEASONS[i])
				.not.toBe(result().get(`${UNKNOWN}-arch`).get("background-color"));
		}
		expect(new Set(arches.map(a => a.get("background-color"))).size).toBe(4);
	});

	// The season is stated in words as well as tinted, so that text has to actually compute a colour.
	it("states the season in text that resolves a colour of its own", () => {
		const line = result().get("winter-line");
		expect(line.missing).toBe(false);
		expect(rgb(line.get("color"))).toHaveLength(3);
	});
});

// WCAG 2.x relative luminance and contrast ratio.
function luminance([r, g, b]) {
	const channel = c => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}
