import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
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
