import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { FONT_AWESOME, bandHtml, windowFor } from "./bandFixture.js";

/**
 * The sheet's three regions — the rail, the top bar over the tabs, and the tab — each on its own
 * ground, and each region on the same ground on both sheets. Reported: the steading's top bar had
 * no ground of its own, so its name and ledger ran straight into the tab.
 *
 * The character's top bar is the real band partial; the steading's is its header with the classes
 * `steading.hbs` gives it.
 */
const STYLES = path.resolve(process.cwd(), "styles");
const probe = new RenderProbe(["themes/palette.css", "themes/parchment-light.css", "themes/parchment-dark.css", "tokens.css", "stonetop.css"]
	.map(f => path.join(STYLES, f)));

const STEADING_HEAD = `
	<header class="sheet-header steading-line stonetop-head" data-density="line">
		<div class="steading-line-row steading-line-values"><h1 class="steading-line-heading">Stonetop</h1></div>
		<div class="steading-line-row steading-line-conditions"><span>lacking</span></div>
	</header>`;

const sheet = ({ kind, theme, width }) => `
${FONT_AWESOME}
<div class="application stonetop sheet actor ${kind} themed theme-${theme}" style="width: ${width}px; height: 900px">
 <div class="window-content"><div class="sheet-wrapper">
  <div class="stonetop-rail-layout">
   <button type="button" class="stonetop-rail-toggle"><i class="fas fa-chevron-left stonetop-rail-caret"></i></button>
   <div class="stonetop-rail"><p>rail</p></div>
   <div class="stonetop-rail-main ${kind}-main">
    ${kind === "character" ? bandHtml({ lang: "en" }) : STEADING_HEAD}
    <nav class="sheet-tabs tabs" data-group="primary"><button type="button" class="item">Play</button></nav>
    <section class="sheet-body"><div class="tab active">a tab</div></section>
   </div>
  </div>
 </div></div>
</div>`;

const PROBES = {
	rail: { selector: ".stonetop-rail", properties: ["background-color"] },
	head: { selector: ".stonetop-head", properties: ["background-color", "border-bottom-color", "border-bottom-width", "padding-top"] },
	tab: { selector: ".window-content", properties: ["background-color", "background-image"] },
	strip: { selector: ".sheet-tabs", properties: ["background-color"] },
	body: { selector: ".sheet-body", properties: ["background-color"] },
};

const COLUMN = 1160, DRAWER = 900;
const TRANSPARENT = "rgba(0, 0, 0, 0)";

const read = ({ kind, theme, width = COLUMN }) => {
	const m = probe.render({
		bodyHtml: sheet({ kind, theme, width }), bodyClass: `game themed theme-${theme}`,
		rootAttrs: 'style="font-size: 16px"', probes: PROBES, chromeFlags: windowFor(width),
	});
	return name => m.get(name).values;
};

for (const theme of ["light", "dark"]) {
	describe.skipIf(!canProbe())(`the sheet's regions, ${theme}`, () => {
		const seen = {};
		beforeAll(() => {
			for (const kind of ["character", "steading"]) {
				seen[kind] = read({ kind, theme });
				seen[`${kind}Drawer`] = read({ kind, theme, width: DRAWER });
			}
		});

		for (const kind of ["character", "steading"]) {
			it(`puts the ${kind}'s rail, top bar and tab on three different grounds`, () => {
				const v = seen[kind];
				const grounds = [v("rail"), v("head"), v("tab")].map(g => g["background-color"]);
				expect(new Set(grounds).size, grounds.join(" | ")).toBe(3);
				expect(grounds).not.toContain(TRANSPARENT);
			});

			// The tab's ground is the window's: the textured paper shows through the strip and body.
			it(`lets the ${kind}'s tab strip and body show the window's textured paper`, () => {
				const v = seen[kind];
				expect(v("strip")["background-color"]).toBe(TRANSPARENT);
				expect(v("body")["background-color"]).toBe(TRANSPARENT);
				expect(v("tab")["background-image"]).toContain("url(");
			});

			// A drawer on the top bar's ground read as part of the top bar.
			it(`keeps the ${kind}'s rail on its own ground as a drawer`, () => {
				expect(seen[`${kind}Drawer`]("rail")["background-color"]).toBe(seen[kind]("rail")["background-color"]);
			});
		}

		for (const region of ["rail", "head", "tab"]) {
			it(`puts the ${region} on the same ground on both sheets`, () => {
				expect(seen.steading(region)["background-color"]).toBe(seen.character(region)["background-color"]);
			});
		}

		it("sets both top bars off the tab with the same rule and the same air above", () => {
			const [c, s] = [seen.character("head"), seen.steading("head")];
			for (const prop of ["border-bottom-color", "border-bottom-width", "padding-top"]) expect(s[prop], prop).toBe(c[prop]);
			expect(c["border-bottom-width"]).not.toBe("0px");
		});
	});
}
