import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// The inventory's small column ends in resource pips flush against the right edge of the scrolling
// tab body, and the scrollbar sat on top of them — Whisky's second ○ was simply not there once the
// tab grew long enough to scroll. Two faults in one: content under the scrollbar, and a tab that
// reflows the moment it overflows. `scrollbar-gutter: stable` reserves the track either way.
//
// Asserted as a CASCADE question, not a geometry one. Whether the gutter is reserved is settled the
// moment the declaration survives core's stylesheet — and the height chain that makes .sheet-body
// scroll comes from the Foundry window itself (.window-content and .stonetop-sheet-layout are both
// flex items sized by their container), which a fixture cannot reproduce without standing up the
// whole window. A probe that renders a non-scrolling body and measures it would pass while saying
// nothing, which is the failure this directory exists to avoid.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
]);

// Markup copied from character.hbs / tab-equipment.hbs, because the rules are selector-specific and
// a simplified stand-in would quietly stop matching them.
const FIXTURE = `
<div class="application stonetop sheet character themed theme-light"><div class="window-content">
  <div class="sheet-wrapper"><div class="sheet-main">
    <div class="stonetop-sheet-layout">
      <div class="sheet-body" id="body">
        <div class="tab equipment active" data-tab="inventory">
          <section class="stonetop-inventory">
            <div class="stonetop-inventory-small">
              <label class="stonetop-inv-item stonetop-inv-small">
                <input type="checkbox" class="stonetop-inventory-item-check stonetop-inv-square" aria-label="carried">
                <span class="stonetop-inv-label" id="label"><strong class="stonetop-inv-name" id="name">Whisky</strong><span class="stonetop-inv-qualifier" id="qualifier">, skin</span></span>
                <span class="stonetop-inv-resources">
                  <button type="button" class="stonetop-inv-resource-btn stonetop-inventory-resource-btn"></button>
                </span>
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div></div>
</div></div>`;

describe.skipIf(!canProbe())("the scrolling tab body reserves its scrollbar gutter", () => {
	let probed;

	beforeAll(() => {
		probed = probe.render({
			bodyHtml: FIXTURE,
			bodyClass: "game themed theme-light",
			probes: {
				body:      { selector: "#body", properties: ["overflow-y", "scrollbar-gutter", "padding-right"] },
				name:      { selector: "#name", properties: ["font-weight"] },
				qualifier: { selector: "#qualifier", properties: ["font-weight"] },
			},
		});
	});

	it("still scrolls the tab body", () => {
		expect(probed.get("body").get("overflow-y")).toBe("auto");
	});

	it("holds the gutter open whether or not the tab is currently scrolling", () => {
		expect(probed.get("body").get("scrollbar-gutter")).toBe("stable");
	});

	it("keeps a little air between the pips and the track", () => {
		expect(probed.get("body").get("padding-right")).toBe("2px");
	});

	// The other half of the same row: the item is what you carry, the qualifier says which one, and
	// bolding only the first is what separates the thing from the tags trailing it. Core's
	// `.window-content` rules reach these elements, so it is worth knowing ours win.
	it("sets the item bold and what qualifies it roman", () => {
		expect(Number(probed.get("name").get("font-weight"))).toBeGreaterThanOrEqual(700);
		expect(Number(probed.get("qualifier").get("font-weight"))).toBeLessThan(700);
	});
});
