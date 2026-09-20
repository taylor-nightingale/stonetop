import { describe, it, expect } from "vitest";
import path from "path";
import { RenderProbe, canProbe, pseudoAsClass } from "./RenderProbe.js";
import { CssColor } from "./cssColor.js";
import { renderPartial } from "../fakes/renderTemplate.js";

// The masthead's name field is QUIET: at rest it is the first half of a sentence — "Anwen, The
// Would-be Hero" — and only hover or focus hands the box back.
//
// Both halves of that have to be measured rather than read off the stylesheet. "No box" is a claim
// about what core's `.window-app input` chrome resolves to once our rule is on top of it, and "the
// box costs nothing to light up" is a claim about the border being reserved rather than grown — a
// field is border-box, so a border that appears on hover takes its 2px out of the name's own room
// and shunts the text sideways under the pointer. Neither is visible in the rule text.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);
const SHEETS = [
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css")
];

/** Headless Chrome has no cursor, so `:hover` is rewritten to a class the fixture can carry. */
const probe = new RenderProbe(SHEETS, { transformCss: pseudoAsClass("hover") });

// The real partial, so the fixture cannot drift from what the sheet renders.
const HEADER = renderPartial("stonetop.actor-header", {
	editable: true,
	actor: { name: "Anwen", img: "anwen.webp" },
	stonetop: { playbook: { slug: "the-would-be-hero", name: "The Would-Be Hero", title: "The Would-Be Hero" } },
});

const withName = name => HEADER.replace('value="Anwen"', `value="${name}"`);

const fixture = (hovered, markup = HEADER) => `
<div class="application stonetop sheet character themed theme-light"><div class="window-content">
  ${hovered ? markup.replace('name="name"', 'name="name" class="is-hover"') : markup}
</div></div>`;

const BOX = ["background-color", "border-top-width", "border-top-color", "border-top-style"];

const boxOf = hovered => probe.render({
	bodyHtml: fixture(hovered),
	bodyClass: "theme-light",
	rootAttrs: 'style="font-size: 16px"',
	probes: { name: { selector: ".charname input[name='name']", properties: BOX } },
}).get("name");

const geometryOf = (hovered, markup) => probe.measure({
	bodyHtml: fixture(hovered, markup),
	bodyClass: "theme-light",
	rootAttrs: 'style="font-size: 16px"',
	targets: { name: ".charname input[name='name']", title: ".stonetop-charname-playbook" },
});

describe.skipIf(!canProbe())("the masthead's quiet name field", () => {
	it("shows no box at rest", () => {
		const name = boxOf(false);
		expect(name.missing).toBe(false);
		expect(CssColor.parse(name.get("background-color")).alpha).toBe(0);
		expect(CssColor.parse(name.get("border-top-color")).alpha).toBe(0);
	});

	it("reserves the border it is not drawing, so lighting it up moves nothing", () => {
		expect(parseFloat(boxOf(false).get("border-top-width"))).toBeGreaterThan(0);
		expect(boxOf(false).get("border-top-style")).not.toBe("none");
	});

	it("hands the box back under the pointer", () => {
		const name = boxOf(true);
		expect(CssColor.parse(name.get("background-color")).alpha).toBeGreaterThan(0);
		expect(CssColor.parse(name.get("border-top-color")).alpha).toBeGreaterThan(0);
	});

	it("leaves the playbook's title exactly where it was", () => {
		expect(geometryOf(true).get("title").textLeft)
			.toBeCloseTo(geometryOf(false).get("title").textLeft, 1);
	});
});

// The field takes the width of the name in it, up to the cap. With the box hidden this stops being
// cosmetic: reserved width nobody is using is a hole between the name and the playbook's title, and
// the reader sees a gap with nothing in it rather than one sentence.
describe.skipIf(!canProbe())("the masthead's field width", () => {
	const widthFor = name => geometryOf(false, withName(name)).get("name").values.boxWidth;

	it("holds a short name in a short field", () => {
		expect(widthFor("Anwen")).toBeLessThan(widthFor("Anwen verch Caradoc"));
	});

	it("stops at the cap rather than taking the header", () => {
		// 22ch of the name face; the long name is well past it, so the field must stop short of both
		// the header's width and the name it cannot fit.
		expect(widthFor("Anwen verch Caradoc of the Ashen Hills"))
			.toBeLessThan(widthFor("Anwen") + 22 * 16);
	});
});

describe.skipIf(!canProbe())("the masthead's sentence", () => {
	it("sets the playbook's title on the same line as the name, to its right", () => {
		const measured = geometryOf(false);
		const name  = measured.get("name");
		const title = measured.get("title");

		expect(title.missing).toBe(false);
		expect(title.values.boxLeft).toBeGreaterThan(name.values.boxLeft + name.values.boxWidth - 1);
		expect(title.boxMiddle).toBeGreaterThan(name.values.boxTop);
		expect(title.boxMiddle).toBeLessThan(name.values.boxTop + name.values.boxHeight);
	});
});
