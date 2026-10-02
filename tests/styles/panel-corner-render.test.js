import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// Every frame drawn from the panel-corner art cuts its corners on a diagonal. Two things can square
// them off again: an edge run tiled past its ends paints over the corner tiles, and a square ground
// shows past the diagonals as four nubs of paper, so the ground is notched to match, the way the
// portrait's is. Notched with gradients rather than `clip-path`: a clip also trims whatever lies past
// the box, and a roll button's focus ring is drawn there by core.

const STYLES = path.resolve("styles");
const sheet = (f) => path.join(STYLES, f);
const probe = new RenderProbe([
	sheet("themes/palette.css"), sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"), sheet("tokens.css"), sheet("stonetop.css"),
]);

const fixture = `
<div class="application stonetop sheet actor character">
  <div class="window-content">
    <section class="stonetop-section-panel" id="p-section"><p>Section</p></section>
    <div class="stonetop-outfit-headers">
      <div class="stonetop-outfit-header" id="p-outfit"><p>Outfit</p></div>
      <div class="stonetop-prosperity-panel" id="p-prosperity"><p>Prosperity</p></div>
    </div>
    <div class="stonetop-follower-card" id="p-follower"><p>Follower</p></div>
  </div>
</div>
<div class="application stonetop-roll-dialog">
  <div class="window-content">
    <div class="stonetop-roll-pick-content" id="p-pick"><p>Pick</p></div>
    <footer class="form-footer"><button type="button" class="dialog-button" id="p-button"><span>Roll</span></button></footer>
  </div>
</div>`;

const FRAMES = {
	section:    "#p-section",
	outfit:     "#p-outfit",
	prosperity: "#p-prosperity",
	follower:   "#p-follower",
	pick:       "#p-pick",
	button:     "#p-button",
};

const PROPERTIES = ["background-color", "background-image", "clip-path"];

describe.skipIf(!canProbe())("a panel-corner frame", () => {
	let probed;

	beforeAll(() => {
		const probes = Object.fromEntries(Object.entries(FRAMES).flatMap(([name, selector]) => [
			[name, { selector, properties: PROPERTIES }],
			[`${name}Rule`, { selector, pseudo: "::before", properties: ["mask-repeat"] }],
		]));
		probed = probe.render({ bodyHtml: fixture, bodyClass: "game vtt theme-light", probes });
	}, 120000);

	it.each(Object.keys(FRAMES))("%s lays each edge run once, between its corners", (name) => {
		const layers = probed.get(`${name}Rule`).get("mask-repeat").split(",").map(l => l.trim());
		expect(layers).toEqual(Array(8).fill("no-repeat"));
	});

	it.each(Object.keys(FRAMES))("%s has no square ground under the notches", (name) => {
		const frame = probed.get(name);
		expect(frame.missing).toBe(false);
		expect(frame.get("background-color")).toBe("rgba(0, 0, 0, 0)");
	});

	it.each(Object.keys(FRAMES))("%s paints its paper notched at all four corners", (name) => {
		const gradients = probed.get(name).get("background-image").match(/linear-gradient\(/g) ?? [];
		expect(gradients).toHaveLength(4);
	});

	it.each(Object.keys(FRAMES))("%s clips nothing that lies past its box", (name) => {
		expect(probed.get(name).get("clip-path")).toBe("none");
	});
});
