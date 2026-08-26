import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// The book illustrations live in a gitignored store, so a world that has not installed the artwork
// has no file behind those refs. HideBrokenImages.js tags each failed <img>; CSS has to take it —
// and the figure around it — out of the page entirely. A half-hidden figure reads as something
// missing, which is worse than nothing at all.
//
// Rendered rather than scanned, because this is a cascade question: our rules sit inside
// `@layer system`, and core's unlayered CSS outranks anything in a layer however specific it is.

const STYLES = path.resolve("styles");
const sheet = (f) => path.join(STYLES, f);
const probe = new RenderProbe([
	sheet("themes/palette.css"), sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"), sheet("tokens.css"), sheet("stonetop.css"),
]);

const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const FIXTURE = `
<div class="application journal-entry">
  <div class="window-content"><div class="journal-entry-page"><div class="stonetop-wonder">
    <figure class="icon" id="p-broken-icon"><img class="stonetop-broken-img" src="missing.png"></figure>
    <figure class="art" id="p-broken-art"><img class="stonetop-broken-img" src="missing.png"></figure>
    <figure class="art" id="p-intact"><img id="p-intact-img" src="${PIXEL}"></figure>
    <p id="p-prose">Prose either side stays.</p>
  </div></div></div>
</div>
<div class="application stonetop sheet actor character">
  <div class="window-content"><img id="p-sheet-img" class="stonetop-broken-img" src="missing.png"></div>
</div>`;

const PROBES = {
	brokenIcon: { selector: "#p-broken-icon", properties: ["display"] },
	brokenArt:  { selector: "#p-broken-art",  properties: ["display"] },
	intact:     { selector: "#p-intact",      properties: ["display"] },
	intactImg:  { selector: "#p-intact-img",  properties: ["display"] },
	sheetImg:   { selector: "#p-sheet-img",   properties: ["display"] },
	prose:      { selector: "#p-prose",       properties: ["display"] },
};

describe.skipIf(!canProbe())("art that could not be installed", () => {
	const seen = new Map();

	beforeAll(() => {
		for (const [k, v] of probe.render({ bodyHtml: FIXTURE, bodyClass: "game vtt theme-light", probes: PROBES })) seen.set(k, v);
	}, 120000);

	it("hides a broken image on a sheet", () => {
		expect(seen.get("sheetImg").get("display")).toBe("none");
	});

	// The wrapper and its margins would otherwise leave a gap where the picture would have been.
	it("takes the figure with it, icon or plate", () => {
		expect(seen.get("brokenIcon").get("display")).toBe("none");
		expect(seen.get("brokenArt").get("display")).toBe("none");
	});

	it("leaves a figure whose image loaded alone", () => {
		expect(seen.get("intact").get("display")).not.toBe("none");
		expect(seen.get("intactImg").get("display")).not.toBe("none");
	});

	it("leaves the prose around it alone", () => {
		expect(seen.get("prose").get("display")).not.toBe("none");
	});
});
