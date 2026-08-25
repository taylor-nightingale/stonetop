import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// An origin name is a <button> for the same reason a tag is: core binds click for [data-action] on
// buttons, so a clickable span is keyboard-dead. It must not READ like one — the names print as a
// comma-separated run of prose under the region, and the commas between them are plain text nodes.
// Anything the button keeps that the commas do not — weight, face, tracking — shows up as the names
// standing out from their own separators.
//
// The bug this guards: the display-font rule near the top of stonetop.css matches
// `.stonetop.sheet button:not(.header-control):not(.control)` at (0,2,1) and set every one of those,
// silently outranking the `all: unset` that was meant to strip the button back to text. Parsing the
// stylesheet cannot see that — both rules are present either way, and only the cascade decides.

const STYLES = path.resolve("styles");
const sheet = (f) => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
]);

// The origin section exactly as tab-playbook.hbs builds it, on the character sheet's window root.
const SECTION = `
<div class="application stonetop sheet actor pbta character themed theme-light"><div class="window-content">
	<div class="sheet-wrapper"><div class="tab"><div class="details-section">
		<div class="stonetop-origin-option selected">
			<label class="stonetop-origin-region">
				<input type="radio" class="stonetop-item-check" name="stonetop-origin" checked>
				<strong id="probe-region">Stonetop</strong>
			</label>
			<div class="stonetop-origin-names" id="probe-run"><button type="button"
				class="stonetop-origin-name" id="probe-name" data-action="selectOriginName">Arwel</button>, <button
				type="button" class="stonetop-origin-name">Bethan</button></div>
		</div>
	</div></div></div>
</div></div>`;

const TEXT = ["font-weight", "font-family", "font-style", "letter-spacing", "text-transform", "color"];

describe.skipIf(!canProbe())("origin names render as prose, not as controls", () => {
	// In a hook, not the suite body: skipIf still runs the body, and the probe throws with no Foundry.
	let name, run, region;
	beforeAll(() => {
		const probed = probe.render({
			bodyHtml: SECTION,
			bodyClass: "theme-light",
			rootAttrs: 'style="font-size: 16px"',
			probes: {
				name:   { selector: "#probe-name", properties: [...TEXT, "background-color", "border-top-width", "padding-left", "min-height"] },
				run:    { selector: "#probe-run", properties: TEXT },
				region: { selector: "#probe-region", properties: TEXT },
			},
		});
		name = probed.get("name");
		run = probed.get("run");
		region = probed.get("region");
	});

	it("finds the name button in the rendered section", () => {
		expect(name.missing).toBe(false);
	});

	// The whole point: a name and the comma after it are one run of text, so every inherited text
	// property has to match. Weight is the one that broke, but it broke as a set.
	it("matches the text it sits among in weight, face and tracking", () => {
		for (const property of TEXT) expect(name.get(property)).toBe(run.get(property));
	});

	// Stated on its own because "not bold" is the thing a reader notices, and a future change to the
	// surrounding run must not be able to make the assertion above pass by bolding both.
	it("is not bold", () => {
		expect(Number(name.get("font-weight"))).toBeLessThan(600);
	});

	// The region heading above the run IS bold, and stays that way — it is what the names belong to.
	it("leaves the region heading bold", () => {
		expect(Number(region.get("font-weight"))).toBeGreaterThanOrEqual(600);
	});

	it("carries none of core's button chrome", () => {
		expect(name.get("border-top-width")).toBe("0px");
		expect(name.get("padding-left")).toBe("0px");
		expect(name.get("background-color")).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
		expect(parseFloat(name.get("min-height") || "0")).toBe(0);
	});
});
