import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderPartial } from "../fakes/renderTemplate.js";

/**
 * The steading speaks in the character sheet's faces, by the same roles: Signika for what you read
 * and type, the book's small caps for names, and the Fell italic for the book's own voice — a
 * condition, a rating's gloss.
 *
 * The body declares `--font-serif` as Foundry's font setting does (Amiri in the dev world), because
 * that is what a rule pointing at the token rather than at the face would silently pick up.
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

const rating = (title, current, note, noteKind) => ({
	title, shortTitle: title.slice(0, 4), isNumeric: true, current, note, noteKind,
});

const tile = (attr, attrData) => renderPartial("stonetop.steading-stat-panel",
	{ attr, attrData, rollable: true, panelClass: `steading-${attr}` });

const fixture = `
<style>body { --font-serif: "Amiri", serif; }</style>
<div class="application stonetop sheet actor character themed theme-light" style="width: 1180px">
 <div class="window-content" id="character"><p class="probe-text">x</p>
  <textarea class="stonetop-cg-text stonetop-grow-field">a choice written in</textarea></div>
</div>
<div class="application stonetop sheet actor steading themed theme-light" style="width: 1180px">
 <div class="window-content" id="steading"><div class="sheet-wrapper">
  <p class="probe-text">x</p>
  <header class="sheet-header steading-line" data-density="line">
   <div class="steading-line-row steading-line-values"><div class="steading-ledger">
    ${tile("prosperity", rating("Prosperity", 2, "→ +0 lacking", "adjustment"))}
    ${tile("defenses", rating("Defenses", 3, "legendary", "tier"))}
   </div></div>
  </header>
  <div class="steading-overview-grid" data-density="full">
   ${tile("defenses", rating("Defenses", 3, "legendary", "tier"))}
  </div>
  <textarea class="stonetop-attr-extra">Farming</textarea>
 </div></div>
</div>`;

const FONT = ["font-family", "font-size"];
const LINE = "#steading .steading-line .steading-tile";
const FULL = '#steading [data-density="full"] .steading-tile';

describe.skipIf(!canProbe())("a steading's typefaces", () => {
	let s;
	beforeAll(() => {
		s = probe.render({
			bodyHtml: fixture, bodyClass: "theme-light", rootAttrs: 'style="font-size: 16px"',
			probes: {
				characterText: { selector: "#character .probe-text", properties: FONT },
				characterField: { selector: "#character .stonetop-cg-text", properties: FONT },
				steadingText:  { selector: "#steading .probe-text", properties: FONT },
				field:         { selector: "#steading .stonetop-attr-extra", properties: FONT },
				value:         { selector: `${LINE}[data-attr="prosperity"] .steading-attr-input`, properties: FONT },
				adjustment:    { selector: `${LINE} .steading-tile-note--adjustment`, properties: FONT },
				lineTier:      { selector: `${LINE} .steading-tile-note--tier`, properties: FONT },
				fullTier:      { selector: `${FULL} .steading-tile-note--tier`, properties: FONT },
				name:          { selector: `${LINE}[data-attr="prosperity"] .steading-stat-roll`, properties: FONT },
			},
		});
	});

	const family = name => s.get(name).get("font-family");

	it("sets its text in the character sheet's face and at its size", () => {
		expect(family("steadingText")).toBe(family("characterText"));
		expect(s.get("steadingText").get("font-size")).toBe(s.get("characterText").get("font-size"));
	});

	// Core sets every textarea in its monospace face; a field is written in the sheet's.
	it("sets what you type, and every number, in that face too", () => {
		expect(family("characterField")).toBe(family("characterText"));
		expect(family("field")).toBe(family("characterText"));
		expect(family("value")).toBe(family("characterText"));
		expect(family("adjustment"), "a note that is a number left the numbers' face").toBe(family("characterText"));
	});

	it("keeps the book's voice in the Fell, never in whatever the font setting made --font-serif", () => {
		expect(family("lineTier")).toContain("IM Fell English");
		expect(family("fullTier")).toContain("IM Fell English");
	});

	it("keeps a rating's name in the small caps", () => {
		expect(family("name")).toContain("StonetopUI");
	});
});
