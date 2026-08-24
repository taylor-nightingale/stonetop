import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { CssColor } from "./cssColor.js";

// The Common & Special Items page is rendered by Foundry's journal sheet, which v13 paints dark by
// default — the same trap the .stonetop-wonder table rules exist for. Whether OUR table rules
// actually reach it through core's cascade layers is not something a text scan of the stylesheet can
// answer, so the page is rendered in real Chrome, in both themes, and read back.

const STYLES = path.resolve("styles");
const sheet = (f) => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
]);

// A slice of the page as build-items.js emits it, inside the journal nesting core gives it.
const FIXTURE = `
<div class="application journal-entry" id="p-journal" style="width: 900px">
  <div class="window-content" id="p-paper">
    <div class="journal-entry-page">
      <div class="stonetop-item-reference" id="p-root">
        <p class="item-ref-pageref" id="p-pageref">Stonetop — p.92-97</p>
        <section class="item-ref-values">
          <h2 id="p-h2">What a Value is worth</h2>
          <div class="item-ref-tiers" id="p-tiers">
            <section class="item-ref-tier" id="p-tier0"><h3>Value 0</h3><ul><li>A ◇ purse of copper coins</li></ul></section>
            <section class="item-ref-tier" id="p-tier1"><h3>Value 1</h3><ul><li>A handful of silver coins</li></ul></section>
            <section class="item-ref-tier" id="p-tier2"><h3>Value 2</h3><ul><li>A single gold coin</li></ul></section>
          </div>
        </section>
        <section class="item-ref-category">
          <h3>Weapons of War</h3>
          <table class="item-ref-table" id="p-table">
            <thead><tr>
              <th id="p-th">Item</th>
              <th class="item-ref-load" id="p-th-load">Load</th>
              <th class="item-ref-value">Value</th>
            </tr></thead>
            <tbody>
              <tr id="p-row1">
                <td id="p-name">Sword, iron <span class="item-ref-detail" id="p-detail">(<em>close</em>, +1 damage)</span></td>
                <td class="item-ref-load" id="p-load">◇</td>
                <td class="item-ref-value" id="p-value">1*</td>
              </tr>
              <tr id="p-row2">
                <td>Dog <div class="item-ref-stats" id="p-stats">HP 6; Damage d6 (<em>hand</em>)</div></td>
                <td class="item-ref-load">□</td>
                <td class="item-ref-value">1</td>
              </tr>
            </tbody>
          </table>
          <p class="item-ref-footnote" id="p-footnote">*Value 2 to get 1 piercing</p>
        </section>
      </div>
    </div>
  </div>
</div>`;

const PROBES = {
	page:     { selector: "#p-root",     properties: ["color"] },
	paper:    { selector: "#p-paper",    properties: ["background-color"] },
	name:     { selector: "#p-name",     properties: ["color", "border-top-color", "font-size"] },
	th:       { selector: "#p-th",       properties: ["color", "background-color"] },
	tiers:    { selector: "#p-tiers",    properties: ["display"] },
	detail:   { selector: "#p-detail",   properties: ["color", "font-size"] },
	stats:    { selector: "#p-stats",    properties: ["color", "display"] },
	load:     { selector: "#p-load",     properties: ["text-align"] },
	value:    { selector: "#p-value",    properties: ["text-align"] },
	tier:     { selector: "#p-tier0",    properties: ["background-color", "border-top-color"] },
	pageref:  { selector: "#p-pageref",  properties: ["color", "font-style"] },
	footnote: { selector: "#p-footnote", properties: ["color"] },
};

const THEMES = [
	{ name: "light", bodyClass: "game vtt theme-light" },
	{ name: "dark",  bodyClass: "game vtt theme-dark" },
];

describe.skipIf(!canProbe())("Common & Special Items page, rendered", () => {
	const rendered = new Map();
	const measured = new Map();

	beforeAll(() => {
		for (const theme of THEMES) {
			rendered.set(theme.name, probe.render({ bodyHtml: FIXTURE, bodyClass: theme.bodyClass, probes: PROBES }));
			measured.set(theme.name, probe.measure({
				bodyHtml: FIXTURE, bodyClass: theme.bodyClass,
				targets: { tier0: "#p-tier0", tier1: "#p-tier1", load: "#p-load", value: "#p-value", name: "#p-name" },
			}));
		}
	}, 120000);

	for (const theme of THEMES) {
		describe(`${theme.name} theme`, () => {
			const probed = (name) => rendered.get(theme.name).get(name);
			const box = (name) => measured.get(theme.name).get(name);

			it("renders every element the page relies on", () => {
				for (const name of Object.keys(PROBES)) expect(probed(name).missing, name).toBe(false);
			});

			// The failure this file exists for: core's journal styling leaving the table unreadable.
			// Measured against the sheet's own parchment — the tier card is a 4%-alpha veil over it,
			// so it is the paper, not the veil, that the ink has to stand out from.
			it("paints the table's ink against the parchment, not core's default", () => {
				const ink = CssColor.parse(probed("name").get("color"));
				const paper = CssColor.parse(probed("paper").get("background-color"));
				expect(ink.over(paper).contrastWith(paper)).toBeGreaterThan(4.5);
			});

			it("gives the header row a visible fill of its own", () => {
				expect(CssColor.parse(probed("th").get("background-color")).alpha).toBeGreaterThan(0);
			});

			it("rules the table's cells", () => {
				expect(probed("name").get("border-top-color")).not.toBe("");
			});

			it("sets the parenthetical and the stat block softer and smaller than the name", () => {
				expect(probed("detail").get("color")).not.toBe(probed("name").get("color"));
				expect(parseFloat(probed("detail").get("font-size")))
					.toBeLessThan(parseFloat(probed("name").get("font-size")));
				expect(probed("stats").get("display")).toBe("block");
			});

			it("centres the Load and Value columns", () => {
				expect(probed("load").get("text-align")).toBe("center");
				expect(probed("value").get("text-align")).toBe("center");
			});

			it("keeps the narrow columns narrower than the name column", () => {
				expect(box("load").values.boxWidth).toBeLessThan(box("name").values.boxWidth);
				expect(box("value").values.boxWidth).toBeLessThan(box("name").values.boxWidth);
			});

			it("lays the Value rungs out side by side on a sheet wide enough for them", () => {
				expect(probed("tiers").get("display")).toBe("grid");
				expect(box("tier0").values.boxTop).toBeCloseTo(box("tier1").values.boxTop, 0);
			});

			it("fits every cell's text inside its box", () => {
				for (const name of ["load", "value", "name", "tier0"]) {
					expect(box(name).overflowY, `${name} overflowY`).toBeLessThanOrEqual(0);
				}
			});

			it("sets the page reference and footnote as quiet, secondary text", () => {
				expect(probed("pageref").get("font-style")).toBe("italic");
				expect(probed("footnote").get("color")).not.toBe(probed("name").get("color"));
			});
		});
	}
});
