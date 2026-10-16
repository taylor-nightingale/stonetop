import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { renderPartial } from "../fakes/renderTemplate.js";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// A panel's ink bar carries a section's name — Background, Basic Moves, Ailments. In the small-caps
// face its lowercase stands at about two-thirds of its size, so at the bar's own --fs-note it read
// near 10px, and at --fs-heading near 12px. The name takes the title role; the book's instruction beside
// it stays fine print.

const STYLES = path.resolve(process.cwd(), "styles");
const probe = new RenderProbe(["themes/palette.css", "themes/parchment-light.css", "themes/parchment-dark.css", "tokens.css", "stonetop.css"]
	.map(f => path.join(STYLES, f)));

const bar = `<header class="stonetop-bar"><span class="stonetop-bar-title">Background</span>
	<span class="stonetop-bar-note">Choose one</span><span class="stonetop-bar-meta"></span></header>`;

const FIXTURE = `
<div class="application stonetop sheet actor character theme-light" id="character">${bar}
	<p class="role-title" style="font-size: var(--fs-title)">x</p><p class="role-fine" style="font-size: var(--fs-fine)">x</p></div>
<div class="application stonetop sheet actor steading theme-light" id="steading">${bar}</div>`;

const PROBES = {
	characterTitle: { selector: "#character .stonetop-bar-title", properties: ["font-size"] },
	characterNote:  { selector: "#character .stonetop-bar-note",  properties: ["font-size"] },
	steadingTitle:  { selector: "#steading .stonetop-bar-title",  properties: ["font-size"] },
	title:          { selector: "#character .role-title",         properties: ["font-size"] },
	fine:           { selector: "#character .role-fine",          properties: ["font-size"] },
};

describe.skipIf(!canProbe())("a panel bar's title", () => {
	let px;
	beforeAll(() => {
		const probed = probe.render({ bodyHtml: FIXTURE, bodyClass: "theme-light", rootAttrs: 'style="font-size: 16px"', probes: PROBES });
		px = name => parseFloat(probed.get(name).get("font-size"));
	});

	it("is set at the title size on the character sheet", () => {
		expect(px("characterTitle")).toBe(px("title"));
	});

	it("is set at the title size on the steading", () => {
		expect(px("steadingTitle")).toBe(px("title"));
	});

	it("leaves the book's instruction beside it as fine print", () => {
		expect(px("characterNote")).toBe(px("fine"));
	});
});

// The rail is a fixed 220px whatever the Font Size, and its bars carry the title and the toggle that
// hangs from the bar's corner. A title that cannot give way pushed the toggle off the bar at the
// default size — "Homefront Moves" alone is wider than the room beside it.
const railBar = title => renderPartial("stonetop.bar", {
	title, index: 0, action: "stonetop.bar-toggle", controls: "moves", open: true,
	labelShow: "Show", labelHide: "Hide",
});

const RAIL_FIXTURE = `
<div class="application stonetop sheet actor steading theme-light" style="width: 1400px">
	<div class="window-content"><div class="sheet-wrapper"><div class="stonetop-rail-layout">
		<div class="stonetop-rail steading-rail" data-density="full">
			<section class="stonetop-panel stonetop-move-panel is-open">${railBar("Homefront Moves")}</section>
		</div>
		<div class="stonetop-rail-main steading-main"></div>
	</div></div></div>
</div>`;

const RAIL_TARGETS = {
	bar:    ".steading-rail .stonetop-bar",
	toggle: ".steading-rail .stonetop-bar-toggle",
};

describe.skipIf(!canProbe())("a bar's title in the rail", () => {
	for (const rootPx of [16, 20]) {
		describe(`at a ${rootPx}px root`, () => {
			let m;
			beforeAll(() => {
				m = probe.measure({
					bodyHtml: RAIL_FIXTURE, bodyClass: "theme-light",
					rootAttrs: `style="font-size: ${rootPx}px"`, targets: RAIL_TARGETS,
					chromeFlags: ["--window-size=1440,900"],
				});
			});

			it("stays inside its bar", () => {
				expect(m.get("bar").overflowX).toBe(0);
			});

			it("leaves the toggle on the bar", () => {
				const bar = m.get("bar").values;
				const toggle = m.get("toggle").values;
				expect(toggle.boxLeft + toggle.boxWidth).toBeLessThanOrEqual(bar.boxLeft + bar.boxWidth + 0.5);
			});
		});
	}
});
