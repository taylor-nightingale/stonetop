import { describe, it, expect } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderLocalized } from "./localizedPartial.js";
import { RollModes } from "../../src/actors/RollModes.js";

/**
 * One control, three surfaces — asserted where the claim can actually fail.
 *
 * roll-mode-picker.hbs says the character band's foot, the steading's ledger line and the stat-pick
 * dialog all render the same partial, and that `variant` picks the arrangement and nothing else. The
 * markup held that; the STYLESHEET quietly did not. The label's face was declared as
 * `.stonetop.sheet.steading .stonetop-rollmode-option > .stonetop-rollmode-label`, so the steading
 * got the house small-caps voice and the character fell through to the body serif at body size — the
 * same three words reading as a labelled control on one sheet and as loose text on the other.
 *
 * Only a renderer can answer this: both sheets' markup is identical by construction, and the whole
 * defect lives in which ancestor selector happened to match.
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

const PICKER = renderLocalized("stonetop.roll-mode-picker", {
	modes: RollModes.options("normal"), name: "stonetop-roll-mode", variant: "inline",
});

/** The character band's FOOT — the line the numbers fold to, which is where this sheet's one picker
 *  lives. The two together are the comparison this file exists for: one partial, one arrangement,
 *  two sheets, both ending a line with it. */
const CHARACTER = `
<div class="application stonetop sheet actor character themed theme-light" style="width: 900px">
 <div class="window-content"><div class="sheet-wrapper top-collapsed">
  <div class="stonetop-rail-layout" data-side="left"><div class="stonetop-rail-main character-main">
   <div class="stonetop-band">
    <div class="stonetop-band-foot">
     <div class="stonetop-folded-ledger">
      <ul class="stonetop-folded-stats stonetop-unmarked"><li><span class="stonetop-folded-abbr">STR</span></li></ul>
     </div>
     ${PICKER}
    </div>
   </div>
  </div></div>
 </div></div>
</div>`;

/** The steading's line, where the mode ends row two beside the conditions. */
const STEADING = `
<div class="application stonetop sheet actor steading themed theme-light" style="width: 900px">
 <div class="window-content"><div class="sheet-wrapper">
  <header class="sheet-header steading-line" data-density="line">
   <div class="steading-line-row steading-line-conditions">
    <div class="steading-conditions"></div>
    ${PICKER}
   </div>
  </header>
 </div></div>
</div>`;

// The face, not the size. Each sheet declares its own --fs-* scale (the steading's `--fs-fine` is
// 0.875rem against the character's 0.8rem), and how big a label is at a given density is that
// surface's business. What must not differ is WHICH VOICE it is set in — that is the thing that was
// wrong, and the thing a re-scoping would break again.
const VOICE = ["font-family", "font-weight", "font-style"];

const voiceOf = bodyHtml => probe.render({
	bodyHtml, bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
	probes: { label: { selector: ".stonetop-rollmode-label", properties: VOICE } },
}).get("label").values;

describe.skipIf(!canProbe())("the roll-mode picker speaks in one voice", () => {
	it("sets the character's line exactly as the steading's", () => {
		expect(voiceOf(CHARACTER)).toEqual(voiceOf(STEADING));
	});

	// The specific half that was wrong, named so a future re-scoping fails loudly rather than
	// silently dropping one sheet back to the body serif.
	it("uses the label face rather than the body serif", () => {
		expect(voiceOf(CHARACTER)["font-family"]).toContain("StonetopUI");
	});

	// Both lines END with it, pushed to the far end. That is the shape the steading's has always had,
	// and the thing the character's never had while it lived on the masthead: up there it was three
	// words at the end of a line with nothing beside them and no rule beneath them, which is what
	// made the same control read as furniture on one sheet and as debris on the other.
	//
	// Nothing is reserved at either end any more. The character's band used to hold 7rem of its right
	// edge for a fold control positioned onto the seam, so a mode that correctly ended the line still
	// stopped an allowance short of it; the control is the last item of the foot now, so "ends the
	// line" means what it says on both sheets.
	it("ends the line on both sheets", () => {
		for (const [label, html, line] of [
			["the character band's foot", CHARACTER, ".stonetop-band-foot"],
			["the steading's ledger line", STEADING, ".steading-line-conditions"],
		]) {
			const m = probe.measure({
				bodyHtml: html, bodyClass: "game themed theme-light",
				rootAttrs: 'style="font-size: 16px"',
				targets: { mode: ".stonetop-rollmode", line },
				chromeFlags: ["--window-size=960,600"],
			});
			const l = m.get("line").values;
			const mode = m.get("mode").values;
			const toEnd = (l.boxLeft + l.boxWidth) - (mode.boxLeft + mode.boxWidth);
			expect(toEnd, `${label}: the mode does not end the line`).toBeLessThanOrEqual(2);
		}
	});
});
