import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

/**
 * What a UI module's blanket form-control reset does to the marks this sheet paints itself.
 *
 * Reported against Carolingian UI: the inventory checkboxes and the move checkboxes disappeared. The
 * cause is one rule (see fixtures/unlayered-blanket-reset.css) and one fact about it — the module's
 * sheet declares no cascade layer, and unlayered CSS outranks every layer, including the `system`
 * layer stonetop.css wraps itself in. Specificity cannot reach it; only `!important` can.
 *
 * Core's checkboxes draw from a Font Awesome glyph, so `border: 0` costs them nothing and a module
 * writing it is being reasonable. Ours set `appearance: none` and paint a box, so the border is not
 * decoration on the mark, it IS the mark: an unchecked diamond with no border is an empty rectangle
 * of nothing. The `min-*` floor is the same mistake in the other direction — a size meant for a
 * glyph, applied to marks drawn at 10-14px.
 *
 * So the claim measured here is not "our styling wins". It is narrower, and it is the only thing
 * worth defending: a mark we paint survives with its geometry intact, while everything a module
 * might legitimately want — colour included — is left alone.
 */
const STYLES = path.resolve(process.cwd(), "styles");
const sheet = f => path.join(STYLES, f);

const SYSTEM_SHEETS = [
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
];

const BLANKET_RESET = path.resolve(process.cwd(), "tests/styles/fixtures/unlayered-blanket-reset.css");

// Every control the sheet gives `appearance: none` and then draws, in the ancestry its rule is
// written against — the diamonds are scoped to `.application.stonetop`, the debility circle to the
// band it sits in, and a mark rendered outside its scope would silently be core's instead of ours.
const fixture = `
<div class="application stonetop sheet character themed theme-light">
 <div class="stonetop-item-header">
  <input type="checkbox" class="stonetop-item-check stonetop-move-check" id="move">
  <input type="checkbox" class="stonetop-cg-track" id="track">
 </div>
 <span class="stonetop-inv-diamonds">
  <input type="checkbox" class="stonetop-inv-diamond" id="diamond">
  <input type="checkbox" class="stonetop-inv-square" id="square">
 </span>
 <label class="stonetop-outfit-load-label">
  <input type="radio" name="load" class="stonetop-outfit-load-radio" id="load">
  <input type="radio" name="mode" class="stonetop-roll-mode-radio" id="mode">
 </label>
 <span class="stonetop-debility">
  <input type="checkbox" class="stonetop-debility-check" id="debility">
 </span>
 <input type="checkbox" class="stonetop-item-check" id="checked-move" checked>
</div>`;

const MARKS = ["move", "track", "diamond", "square", "load", "mode", "debility"];

const PROPERTIES = [
	"appearance", "border-top-width", "border-top-style", "border-top-color",
	"width", "height", "min-width", "min-height", "margin-top",
];

const probes = Object.fromEntries(
	[...MARKS, "checked-move"].map(name => [name, { selector: `#${name}`, properties: PROPERTIES }]));

// The glyph core would otherwise paint on top of a mark we have already drawn.
probes["checked-glyph"] = { selector: "#checked-move", pseudo: "::before", properties: ["content"] };
probes["checked-glyph-after"] = { selector: "#checked-move", pseudo: "::after", properties: ["content"] };

const render = withReset => new RenderProbe(withReset ? [...SYSTEM_SHEETS, BLANKET_RESET] : SYSTEM_SHEETS)
	.render({
		bodyHtml: fixture,
		bodyClass: withReset ? "game theme-light unlayered-module" : "game theme-light",
		rootAttrs: 'style="font-size: 16px"',
		probes,
	});

describe.skipIf(!canProbe())("a mark the sheet paints itself, under an unlayered blanket form-control reset", () => {
	let plain;
	let reset;
	beforeAll(() => { plain = render(false); reset = render(true); });

	it("renders every mark in both fixtures", () => {
		for (const name of MARKS) {
			expect(plain.get(name).missing, `${name} did not render`).toBe(false);
			expect(reset.get(name).missing, `${name} did not render under the reset`).toBe(false);
		}
	});

	// The premise the rest of the file rests on. If one of these ever stops computing `appearance:
	// none` it is core's checkbox again, and it wants core's treatment, not this one.
	it.each(MARKS)("paints %s itself rather than leaving it to the browser", name => {
		expect(plain.get(name).get("appearance")).toBe("none");
	});

	// The reported bug, stated as the thing a reader would see: nothing at all where a mark was.
	it.each(MARKS)("leaves %s a border to be drawn with", name => {
		const el = reset.get(name);
		expect(el.get("border-top-style"), `${name} lost its border style`).not.toBe("none");
		expect(parseFloat(el.get("border-top-width")), `${name} lost its border width`).toBeGreaterThan(0);
	});

	// Measured against the same mark without the module rather than against numbers written here, so
	// the assertion survives the type scale moving.
	it.each(MARKS)("draws %s at the size it draws it at unmodded", name => {
		for (const property of ["border-top-width", "width", "height"]) {
			expect(reset.get(name).get(property), `${name} ${property} moved`)
				.toBe(plain.get(name).get(property));
		}
	});

	// `margin: 0 2px` replaces the shorthand whole, and the offset that centres a 14px tick on a
	// 17.5px line of text goes with it — the tick then rides the top of the line it ticks.
	it("keeps the acquisition check pinned to the first line of the move beside it", () => {
		expect(parseFloat(plain.get("move").get("margin-top"))).toBeGreaterThan(0);
		expect(reset.get("move").get("margin-top")).toBe(plain.get("move").get("margin-top"));
	});

	// A module repainting core's glyph has nothing to repaint here, and must not be given one: the
	// pseudo would paint a second mark over the mark.
	it("gives a module's checked-state glyph no pseudo-element to paint on", () => {
		expect(reset.get("checked-glyph").get("content")).toBe("none");
		expect(reset.get("checked-glyph-after").get("content")).toBe("none");
	});

	// The other half of the bargain: everything that is not load-bearing stays the module's to set.
	it("lets the module recolour a mark and set its horizontal margin", () => {
		expect(reset.get("move").get("min-width")).toBe("0px");
		expect(reset.get("diamond").get("border-top-color")).toBe(plain.get("diamond").get("border-top-color"));
	});
});

/**
 * The two lists name the same set — the controls this sheet paints itself — and they are three
 * thousand lines apart. A new control added to one and not the other is the failure this catches:
 * missing from the pseudo killer it grows core's glyph on top of itself, missing from the reset
 * block it vanishes under the next module that ships unlayered.
 */
describe("the controls the stylesheet declares it paints itself", () => {
	// Comments out first: both blocks carry a long one, and a comma inside prose reads as a selector.
	const css = readFileSync(sheet("stonetop.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

	/** The selector list of the first rule whose body contains `declaration`. */
	const selectorsOf = declaration => {
		const rule = new RegExp(`([^{}]+)\\{[^{}]*${declaration}[^{}]*\\}`).exec(css);
		return new Set(rule[1].split(",").map(s => s.trim()).filter(Boolean));
	};

	it("names the same controls in the pseudo killer and the blanket-reset block", () => {
		const painted = selectorsOf("min-width: 0 !important");
		const pseudos = selectorsOf("content: none !important");
		const base = new Set([...pseudos].map(s => s.replace(/::(before|after)$/, "")));
		expect([...painted].sort()).toEqual([...base].sort());
	});
});
