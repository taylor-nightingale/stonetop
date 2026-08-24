import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// A displayed tag is a <button> for one reason only: core binds click for [data-action] on buttons,
// so a clickable span is keyboard-dead. It must not LOOK like a button — the book prints tags as
// italic text inside the item's line, and core's button theming (a background, a border, padding,
// `min-height: var(--button-size)`, and .window-app's full-width stretch) turns that line into a row
// of chunky controls.
//
// Text-parsing the stylesheet cannot answer this: the reset rules exist either way, and whether they
// beat core's depends on the cascade. Only a browser knows what the button ended up as, so this
// renders one against core's real stylesheet and reads the computed values back.

const STYLES = path.resolve("styles");
const sheet = (f) => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
]);

// An inventory row exactly as outfit-item-row.hbs builds it — the book's one parenthetical holding
// the italic tags and then the roman note: `Spear, iron (close, large, x piercing)`.
const ROW = `
<div class="application stonetop sheet character themed theme-light"><div class="window-content">
	<div class="stonetop-inv-item">
		<span class="stonetop-inv-label" id="probe-label">Spear, iron<span
			class="stonetop-inv-parens" id="probe-parens"> (<span class="stonetop-tag-list"><button
			type="button" class="stonetop-tag is-defined" id="probe-tag" data-action="showTagDefinition"
			data-definition="melee range, 1-2 steps away.">close</button>, <span
			class="stonetop-tag" id="probe-plain">large</span></span>, <span
			class="stonetop-inv-note" id="probe-note">x piercing</span>)</span>
		</span>
	</div>
</div></div>`;

const BOX = [
	"display", "font-style", "font-size", "font-family", "color",
	"background-color", "border-top-width", "border-left-width",
	"padding-top", "padding-left", "min-height", "height", "width", "text-align",
];

describe.skipIf(!canProbe())("a displayed tag renders as italic text, not a control", () => {
	// In a hook, not the suite body: skipIf still runs the body, and the probe throws with no Foundry.
	let tag, plain, note, label, parens;
	beforeAll(() => {
		const probed = probe.render({
			bodyHtml: ROW,
			bodyClass: "theme-light",
			rootAttrs: 'style="font-size: 16px"',
			probes: {
				tag:   { selector: "#probe-tag", properties: BOX },
				label: { selector: "#probe-label", properties: BOX },
				plain: { selector: "#probe-plain", properties: BOX },
				note:  { selector: "#probe-note", properties: BOX },
				parens: { selector: "#probe-parens", properties: BOX },
			},
		});
		tag = probed.get("tag");
		plain = probed.get("plain");
		note = probed.get("note");
		label = probed.get("label");
		parens = probed.get("parens");
	});

	it("finds the tag in the rendered row", () => {
		expect(tag.missing).toBe(false);
	});

	// The chrome that made it look "awful": each of these is something core puts on a button.
	it("carries none of core's button chrome", () => {
		expect(tag.get("border-top-width")).toBe("0px");
		expect(tag.get("border-left-width")).toBe("0px");
		expect(tag.get("padding-top")).toBe("0px");
		expect(tag.get("padding-left")).toBe("0px");
		expect(tag.get("background-color")).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
	});

	// Core sets `display: flex` on buttons — a flex box mid-sentence is the thing to prevent. The
	// stylesheet asks for `inline`; Blink blockifies form controls to `inline-block` whatever the
	// rule says, so inline-block IS the win here, and the geometry test below is what proves the
	// box still sits in the line.
	it("is not laid out as a flex or block box", () => {
		expect(tag.get("display")).toBe("inline-block");
	});

	it("keeps text-aligned left rather than centred like a control", () => {
		expect(tag.get("text-align")).toBe("left");
	});

	// min-height: var(--button-size) is the one that beats a plain height (see .stonetop-tag-chip).
	it("keeps no button-sized minimum height", () => {
		expect(parseFloat(tag.get("min-height") || "0")).toBe(0);
	});

	it("is italic, as the book prints a tag", () => {
		expect(tag.get("font-style")).toBe("italic");
		expect(plain.get("font-style")).toBe("italic");
	});

	// A button does not inherit font or colour from its surroundings unless told to; a tag rendered
	// in the browser's default UI font at its default size is exactly the "messes up the formatting"
	// failure. Size and family come from the row; colour comes from the parenthetical it sits in,
	// which is toned down from the item name — so the tag matches the note beside it, not the name.
	it("takes its font from the row and its colour from the parenthetical", () => {
		expect(tag.get("font-size")).toBe(label.get("font-size"));
		expect(tag.get("font-family")).toBe(label.get("font-family"));
		expect(tag.get("color")).toBe(parens.get("color"));
		expect(tag.get("color")).toBe(note.get("color"));
	});

	// The brackets and the note are the book's roman text; only the tags lean.
	it("leaves the parenthetical itself upright, with only the tags italic", () => {
		expect(parens.get("font-style")).toBe("normal");
		expect(note.get("font-style")).toBe("normal");
		expect(tag.get("font-style")).toBe("italic");
	});

	it("renders an undefined tag as the same italic text, minus the affordance", () => {
		expect(plain.get("display")).toBe("inline");
		expect(plain.get("font-size")).toBe(tag.get("font-size"));
	});
});

// Computed values say what the cascade decided; only geometry says whether the tag still reads as
// part of the line. A button that stretched to the row, or dropped to its own line, would pass every
// assertion above.
describe.skipIf(!canProbe())("a displayed tag sits in the line, not beside it", () => {
	// In a hook, not the suite body: skipIf still runs the body, and the probe throws with no Foundry.
	let measured;
	beforeAll(() => {
		measured = probe.measure({
			bodyHtml: ROW,
			bodyClass: "theme-light",
			rootAttrs: 'style="font-size: 16px"',
			targets: { tag: "#probe-tag", plain: "#probe-plain", note: "#probe-note", label: "#probe-label" },
		});
	});
	const box = (name) => measured.get(name);

	it("shares a line with the plain tag and the note beside it", () => {
		expect(box("tag").values.boxTop).toBeCloseTo(box("plain").values.boxTop, 0);
		expect(box("tag").values.boxTop).toBeCloseTo(box("note").values.boxTop, 0);
	});

	// .window-app stretches buttons to full width; that is what turned the row into a stack.
	it("hugs its word instead of stretching across the row", () => {
		expect(box("tag").values.boxWidth).toBeLessThan(box("label").values.boxWidth / 4);
	});

	it("stays about as tall as the text it sits among", () => {
		expect(box("tag").values.boxHeight).toBeLessThan(box("note").values.boxHeight + 4);
	});
});
