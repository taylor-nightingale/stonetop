import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// The type scale's contract with Foundry, asserted against what a browser actually computes.
//
// Foundry's Font Size setting is not a Foundry-specific API we opt into — it is `Game#configureUI`
// writing one px value from the ladder [8, 10, 12, 14, 16, 18, 20, 24, 28, 32] onto
// `html { font-size }`. So "the system honours the accessibility setting" reduces to one testable
// property: every sheet size is expressed in rem, and therefore every sheet size moves when that
// px value moves. A token that quietly became px still LOOKS right at the default step and stops
// responding at every other one — which is exactly the failure a user reports as "the setting does
// nothing", and exactly the failure no text-parsing test can see.
//
// `uiScale`, the other half of core's UI config, is deliberately not modelled here: core applies it
// as `transform: scale()` on the #ui-* chrome and never on an application window, so it cannot
// scale sheet text and is not a substitute for this.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css")
]);

/** The ladder core maps the ten setting steps onto, and the step it ships as default. */
const FOUNDRY_FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32];
const FOUNDRY_DEFAULT_PX = FOUNDRY_FONT_SIZES[4];

const ROLES = ["micro", "fine", "note", "body", "label", "subheading", "heading", "title", "display", "name"];

// One element per role, each reading the token the same way a sheet rule does.
const SCALE_FIXTURE = `<div class="stonetop sheet"><div class="window-content">
${ROLES.map(r => `<p id="fs-${r}" style="font-size: var(--fs-${r})">Sample</p>`).join("\n")}
<p id="fs-core" style="font-size: var(--font-size-15)">Core body</p>
</div></div>`;

const scaleProbes = Object.fromEntries(
	[...ROLES.map(r => [r, { selector: `#fs-${r}`, properties: ["font-size"] }]),
		["core", { selector: "#fs-core", properties: ["font-size"] }]]
);

/** @returns {Map<string, number>} role → computed px, at the given root font size */
function scaleAt(rootPx) {
	const probed = probe.render({
		bodyHtml: SCALE_FIXTURE,
		bodyClass: "theme-light",
		rootAttrs: `style="font-size: ${rootPx}px"`,
		probes: scaleProbes
	});
	return new Map([...probed].map(([role, el]) => [role, parseFloat(el.get("font-size"))]));
}

describe.skipIf(!canProbe())("type scale", () => {
	// In a hook, not the suite body: skipIf still runs the body, and the probe throws with no Foundry.
	let atDefault;
	beforeAll(() => { atDefault = scaleAt(FOUNDRY_DEFAULT_PX); });

	it("resolves every role to a real size", () => {
		for (const role of ROLES) expect(atDefault.get(role), role).toBeGreaterThan(0);
	});

	it("reads no smaller than core's own body text at the smallest legible role", () => {
		// --fs-body is the size a sheet's primary prose renders at. A sheet that reads smaller than
		// the chrome around it is the complaint this scale exists to answer.
		expect(atDefault.get("body")).toBe(atDefault.get("core"));
	});

	it("keeps 10 distinct, monotonically increasing steps", () => {
		const sizes = ROLES.map(r => atDefault.get(r));
		expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
		expect(new Set(sizes).size).toBe(ROLES.length);
	});

	it("holds every role above the threshold where fine print stops being readable", () => {
		// 11px is the floor; below it a role is decorative, not text.
		for (const role of ROLES) expect(atDefault.get(role), role).toBeGreaterThanOrEqual(11);
	});

	it.each(FOUNDRY_FONT_SIZES.filter(px => px !== FOUNDRY_DEFAULT_PX))(
		"scales every role proportionally at Foundry font size %ipx", rootPx => {
			const scaled = scaleAt(rootPx);
			const factor = rootPx / FOUNDRY_DEFAULT_PX;
			for (const role of ROLES) {
				// Sub-pixel: browsers round computed font-size, so compare to within half a px.
				expect(scaled.get(role), role).toBeCloseTo(atDefault.get(role) * factor, 0);
			}
		}
	);
});
