import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// What the harvest watermark does to the steps, settled in a browser.
//
// This file has had three subjects, and the first two both passed while the layout was visibly
// wrong. It began asserting that a floated plate's `shape-outside` resolved — which it did, to a URL
// that 404'd, so the shape silently computed to `none` for months. Then it asserted the shape
// reached the text — which it did, at the cost of a JavaScript strut whose position was a
// discontinuous function of the sheet's width, so the plate crawled and jumped as you dragged it.
//
// The plate is a background now, and the claim is the one that makes that worth doing: it takes no
// part in layout. The fixture renders the same steps twice, with the mark and without, and every
// measurement has to match. Anything that puts the art back in the flow breaks this.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"), sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"), sheet("tokens.css"), sheet("stonetop.css"),
]);

// A 2×1 PNG standing in for the plate: the mark is sized by the rule, not by the image.
const PLATE = "data:image/png;base64,"
	+ "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGNgAAIREZH/AAG8ATxDzPeRAAAAAElFTkSuQmCC";

const PROSE = "The steading must consume additional Surplus equal to 1d4+Population before winter "
	+ "ends or suffer the consequences as above.";

// `marked` carries the custom property the template sets; `bare` is the same steps in a world with
// no art installed.
const box = (id, plate) => `
	<section class="steading-season-box" data-season="winter">
		<ol class="steading-turn-steps" id="${id}-list"
		    ${plate ? `style="--seasons-plate: url('${PLATE}')"` : ""}>
			<li class="steading-turn-step" id="${id}-step">
				<span class="steading-turn-num" id="${id}-num">4</span>
				<div class="steading-turn-body-step">
					<div class="steading-turn-text" id="${id}-text">Then, roll +Fortunes.</div>
					<div class="steading-turn-tiers stonetop-result-rows">
						<div class="stonetop-result-row stonetop-result-row--partial" id="${id}-row">
							<span class="stonetop-result-label">7-9</span>
							<div class="stonetop-result-body">${PROSE}</div>
						</div>
					</div>
				</div>
			</li>
			<li class="steading-turn-step" id="${id}-last">
				<span class="steading-turn-num">5</span>
				<div class="steading-turn-body-step">
					<div class="steading-turn-text">Reset Fortunes to +1.</div>
				</div>
			</li>
		</ol>
		<div class="steading-upkeep" id="${id}-upkeep">
			<h4 class="steading-upkeep-label">What the steading keeps up</h4>
		</div>
	</section>`;

const FIXTURE = `
<div class="application app stonetop sheet actor steading" style="width: 900px">
  <div class="window-content">
    ${box("marked", true)}
    ${box("bare", false)}
  </div>
</div>`;

describe.skipIf(!canProbe())("the harvest watermark", () => {
	const measured = new Map();
	const style = new Map();

	beforeAll(() => {
		for (const [k, v] of probe.measure({
			bodyHtml: FIXTURE, bodyClass: "game vtt theme-light",
			targets: {
				markedList: "#marked-list", bareList: "#bare-list",
				markedRow: "#marked-row", bareRow: "#bare-row",
				markedText: "#marked-text", bareText: "#bare-text",
				markedStep: "#marked-step", bareStep: "#bare-step",
				markedUpkeep: "#marked-upkeep", bareUpkeep: "#bare-upkeep",
			},
		})) measured.set(k, v);

		for (const [k, v] of probe.render({
			bodyHtml: FIXTURE, bodyClass: "game vtt theme-light",
			probes: {
				mark: {
					selector: "#marked-list", pseudo: "::after",
					properties: ["position", "content", "opacity", "background-image", "pointer-events"],
				},
				bare: { selector: "#bare-list", pseudo: "::after", properties: ["background-image"] },
				row:  { selector: "#marked-row", properties: ["display"] },
			},
		})) style.set(k, v);
	}, 120000);

	// The whole reason for a background: the steps lay out identically with and without the art, so
	// there is no height to reconcile and nothing to measure.
	it("changes nothing about the steps", () => {
		for (const part of ["List", "Row", "Text", "Step", "Upkeep"]) {
			const marked = measured.get(`marked${part}`).values;
			const bare   = measured.get(`bare${part}`).values;
			expect([part, marked.boxWidth, marked.boxHeight])
				.toEqual([part, bare.boxWidth, bare.boxHeight]);
		}
	});

	// The mark is drawn, and drawn out of flow. `content` resolving to `none` would mean the pseudo
	// never generated at all — which is exactly what the narrow-sheet query does on purpose.
	it("draws the mark out of flow", () => {
		expect(style.get("mark").get("position")).toBe("absolute");
		expect(style.get("mark").get("content")).not.toBe("none");
		expect(style.get("mark").get("pointer-events")).toBe("none");
		expect(Number(style.get("mark").get("opacity"))).toBeLessThan(0.4);
	});

	// The path comes from the element. Without it the rule's fallback draws nothing, which is every
	// world that has not installed Book I's art.
	it("draws nothing when the world has no plate", () => {
		expect(style.get("mark").get("background-image")).toContain("url(");
		expect(style.get("bare").get("background-image")).toBe("none");
	});

	// The shared result rows were rebuilt out of grid to chase the old float's shape. They are a
	// grid again, and nothing about the watermark needs them not to be.
	it("leaves the shared result rows as the grid they are", () => {
		expect(style.get("row").get("display")).toBe("grid");
	});
});
