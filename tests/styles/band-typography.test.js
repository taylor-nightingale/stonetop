import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

/**
 * Two chips in one row, in two different fonts.
 *
 * A chip that ROLLS is a <button> and a chip that does not is a <span>, and core's button styling is
 * UNLAYERED — so it outranks everything in `@layer system` however specific, and set the stat
 * abbreviations and Damage in Signika 700 while HP, Armor and the names beside them kept the book's
 * small-caps face. The steading hit this first, on a rating's name; the fix is the same block.
 *
 * Only a renderer can answer it. Every rule in the chain is perfectly valid and says the right
 * thing; which one WINS is the whole question, and that is the cascade's to decide.
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

const FIXTURE = `
<div class="application stonetop sheet actor character themed theme-light"><div class="window-content">
 <div class="stonetop-stats-row">
  <div class="stonetop-stat" data-stat="str">
   <button type="button" class="stonetop-stat-roll rollable" id="stat-roll" data-roll="str">STR</button>
   <input class="stonetop-stat-input" type="number" value="1">
  </div>
 </div>
 <div class="stonetop-resource-row stonetop-resource-row--vitals">
  <div class="stonetop-vital"><div class="stonetop-resource stonetop-resource--wide">
   <span class="stonetop-resource__label" id="plain-label">HP</span>
  </div></div>
  <div class="stonetop-vital"><div class="stonetop-resource stonetop-resource--small">
   <button class="stonetop-resource__label stonetop-damage-roll rollable" type="button"
           id="damage-label" data-roll="damage">Schaden</button>
  </div></div>
 </div>
 <div class="stonetop-debilities">
  <div class="stonetop-debility is-active">
   <label class="stonetop-debility-control">
    <span class="stonetop-debility-band"><span class="stonetop-debility-divider"></span>
     <input type="checkbox" class="stonetop-debility-check" checked></span>
    <span class="stonetop-debility-label" id="debility-name">Weakened</span>
    <span class="stonetop-debility-effect" id="debility-effect">Take disadvantage.</span>
   </label>
  </div>
 </div>
</div></div>
<div class="application stonetop sheet actor steading themed theme-light"><div class="window-content">
 <button type="button" class="steading-stat-roll" id="steading-roll">Fortunes</button>
 <span class="steading-debility-name" id="steading-condition">Diminished</span>
 <span class="steading-debility-effect" id="steading-effect">Treat Prosperity as one lower.</span>
 <header class="sheet-header steading-line" data-density="line">
  <span class="steading-debility-name" id="steading-line-condition">lacking</span>
 </header>
</div></div>`;

const FONT = ["font-family", "font-size", "letter-spacing", "--fs-fine"];
const PROBES = Object.fromEntries([
	["statRoll", "#stat-roll"], ["plainLabel", "#plain-label"], ["damageLabel", "#damage-label"],
	["debilityName", "#debility-name"],
	["steadingRoll", "#steading-roll"], ["steadingCondition", "#steading-condition"],
	["steadingLineCondition", "#steading-line-condition"],
	["steadingEffect", "#steading-effect"],
].map(([name, selector]) => [name, { selector, properties: [...FONT, "min-height", "height"] }]));

describe.skipIf(!canProbe())("the band's chips are all in one face", () => {
	let m;
	beforeAll(() => {
		m = probe.render({
			bodyHtml: FIXTURE, bodyClass: "game themed theme-light",
			rootAttrs: 'style="font-size: 16px"', probes: PROBES,
		});
	});
	const face = name => m.get(name).get("font-family");

	it("renders every chip", () => {
		for (const [name, probed] of m) expect(probed.missing, `${name} did not render`).toBe(false);
	});

	// The book's face, not core's UI one — asserted against the STEADING's rollable name rather than
	// against a string written here, so the two sheets cannot drift apart without this saying so.
	it("sets the rollable chips in the same face as a steading rating's name", () => {
		expect(face("statRoll"), "the stat abbreviation is not in the book's face").toBe(face("steadingRoll"));
		expect(face("damageLabel"), "Damage is not in the book's face").toBe(face("steadingRoll"));
	});

	// The half that made the bug visible: the two kinds of chip sat side by side in different fonts.
	it("sets a rollable chip in the same face as the plain one beside it", () => {
		expect(face("statRoll")).toBe(face("plainLabel"));
		expect(face("damageLabel")).toBe(face("plainLabel"));
	});

	// A chip is a hole punched in the frame's rule, positioned by its own centre. Core floors every
	// button at `min-height: 2em`, which made the two rollable chips half again as deep a notch as
	// the plain ones — 28px against 19px.
	it("gives a rollable chip the height of its own line, not core's button floor", () => {
		for (const name of ["statRoll", "damageLabel"]) {
			expect(parseFloat(m.get(name).get("min-height")), `${name} kept core's 2em floor`).toBe(0);
			expect(parseFloat(m.get(name).get("height")), `${name} is deeper than the plain chip beside it`)
				.toBeLessThanOrEqual(parseFloat(m.get("plainLabel").get("height")) + 1);
		}
	});

	// The debility reads as the steading's conditions do — the ones on its LINE, which is the density
	// that writes them in the book's roman, italic and lowercase, rather than the small-caps voice the
	// steading's full band gives them. "weakened" is something that is true of you, not a label; the
	// band's own notes ("playbook", "none worn") are already saying so two rows down in this italic.
	// Same face, not the same pixels: the steading runs its whole scale one step up on purpose.
	it("sets the debility in the same face as a steading condition on its line", () => {
		expect(face("debilityName")).toBe(face("steadingLineCondition"));
	});

	// The NAME only. The effect is carried for assistive tech and drawn nowhere — the band is one line
	// tall — so what face it would have been set in is no longer a question the page asks.
	it("sizes the debility from its own sheet's fine-print role", () => {
		const fine = m.get("debilityName").get("--fs-fine");
		expect(fine, "--fs-fine is not declared for the character sheet").not.toBe("");
		expect(m.get("debilityName").get("font-size"), "debilityName is off the role scale")
			.toBe(`${parseFloat(fine) * 16}px`);
		// And the steading takes the same ROLE for its own, at its own step of the scale.
		expect(m.get("steadingCondition").get("font-size"))
			.toBe(`${parseFloat(m.get("steadingCondition").get("--fs-fine")) * 16}px`);
	});
});
