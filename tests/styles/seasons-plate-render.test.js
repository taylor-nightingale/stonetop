import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// What the floated harvest plate actually does to the text beside it, settled in a browser.
//
// The claim the layout rests on cannot be checked by reading the stylesheet. `shape-outside` takes a
// url() from a custom property set on the ELEMENT, because the path is produced at runtime by the art
// installer and a url() in the stylesheet would resolve against the stylesheet. If that property
// never reaches the rule — a typo, a var() that does not resolve, an image the page cannot read —
// `shape-outside` silently computes to `none`, the text wraps to the plate's BOX instead of its art,
// and every text-based assertion in seasons-plate-layout.test.js still passes.
//
// The art slants up and to the right, so the lower-left of its box is transparent. Wrapping to the
// box leaves that wedge blank and breaks every line against an invisible straight edge; wrapping to
// the alpha lets the text reach into it. The fixture's plate is that shape reduced to its essentials
// — a 2×1 PNG, left pixel transparent, right pixel opaque — so "the text reaches into the box" is
// measurable: at the same width, with the same words, the shaped column fits in FEWER lines.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"), sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"), sheet("tokens.css"), sheet("stonetop.css"),
]);

// Left half transparent, right half opaque — the plate's silhouette, at its simplest.
const PLATE = "data:image/png;base64,"
	+ "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGNgAAIREZH/AAG8ATxDzPeRAAAAAElFTkSuQmCC";

const PROSE = ("When the hot days of summer settle across the land, whoever is most content rolls "
	+ "+Fortunes: on a 10+, pick 2 seasonal gains; on a 7-9, pick 1 seasonal gain. ").repeat(3);

// Two turn controls, identical but for the shape: one takes the rule as shipped, the other has
// shape-outside forced off, which is what a var() that failed to resolve would produce.
const turn = (id, extraStyle) => `
	<section class="steading-turn steading-block is-open" data-season="summer" id="${id}">
		<div class="steading-season-box" id="${id}-body">
			<img class="steading-seasons-plate" id="${id}-plate" src="${PLATE}" alt=""
			     style="--plate: url('${PLATE}'); ${extraStyle}">
			<p class="stonetop-item-description" id="${id}-text">${PROSE}</p>
		</div>
	</section>`;

const FIXTURE = `
<div class="application app stonetop sheet actor steading" style="width: 700px">
  <div class="window-content">
    ${turn("shaped", "")}
    ${turn("boxed", "shape-outside: none;")}
  </div>
</div>`;

describe.skipIf(!canProbe())("the floated harvest plate", () => {
	const box = new Map();
	const style = new Map();

	beforeAll(() => {
		for (const [k, v] of probe.measure({
			bodyHtml: FIXTURE, bodyClass: "game vtt theme-light",
			targets: {
				shapedText: "#shaped-text", boxedText: "#boxed-text",
				shapedPlate: "#shaped-plate", shapedBody: "#shaped-body",
			},
		})) box.set(k, v);

		for (const [k, v] of probe.render({
			bodyHtml: FIXTURE, bodyClass: "game vtt theme-light",
			probes: {
				plate: { selector: "#shaped-plate", properties: ["float", "shape-outside", "position"] },
				body:  { selector: "#shaped-body",  properties: ["display"] },
			},
		})) style.set(k, v);
	}, 120000);

	// The custom property reached the rule. `none` here is the silent failure this file exists for.
	it("resolves its shape from the url passed in on the element", () => {
		expect(style.get("plate").get("shape-outside")).toContain("url(");
		expect(style.get("plate").get("shape-outside")).not.toBe("none");
	});

	it("floats rather than being positioned out of flow", () => {
		expect(style.get("plate").get("float")).toBe("right");
		expect(style.get("plate").get("position")).toBe("static");
	});

	// The measurable consequence of wrapping to the ART: the same words at the same width fit in a
	// shorter column, because the transparent half of the plate's box is text the box shape excludes.
	it("lets the text into the transparent half of the plate's box", () => {
		const shaped = box.get("shapedText").values.boxHeight;
		const boxed  = box.get("boxedText").values.boxHeight;
		expect(shaped).toBeLessThan(boxed);
	});

	// A float that escapes its control would sit over "During <season>" below it. `flow-root` on the
	// body is what contains it, and the height of the body is how you can tell it worked.
	it("is contained by the body it floats inside", () => {
		expect(style.get("body").get("display")).toBe("flow-root");
		expect(box.get("shapedBody").values.boxHeight)
			.toBeGreaterThanOrEqual(box.get("shapedPlate").values.boxHeight);
	});
});
