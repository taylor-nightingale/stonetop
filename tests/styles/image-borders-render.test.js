import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { readFileSync } from "fs";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// Images on a Stonetop surface carry NO frame of their own — not a border, not a glow, not an
// outline. The book's plates are line art on parchment and our icons are cut-out glyphs; a box drawn
// round either is core's chrome showing through, and it has come back repeatedly because each time
// it was chased off one element rather than answered once.
//
// Core draws that frame from two places, which is why one rule never held:
//   `body.game .app img`  → `border: 1px solid var(--color-border-dark)`   (@layer compatibility)
//   `figure img`          → `border` AND `box-shadow: 0 0 4px #000`        (@layer elements.media)
// Core's own escape hatch (`img.noborder`) clears border, box-shadow and outline together — three
// properties, which is the tell that stripping only the border leaves a visible ring behind.
//
// Rendered, not scanned: this is a cascade question — layer order, core's stylesheet and ours — and
// text assertions have passed while the frame was plainly on screen.

const STYLES = path.resolve("styles");
const sheet = (f) => path.join(STYLES, f);
const probe = new RenderProbe([
	sheet("themes/palette.css"), sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"), sheet("tokens.css"), sheet("stonetop.css"),
]);

const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

// Every shape an image takes on our surfaces: bare in the markup, wrapped in a <figure>, a control's
// icon, and a portrait. The <figure> case carries no class of ours on purpose — the rule that strips
// core's border is on the `img`, so it must hold whatever the picture is wrapped in, and a fixture
// that names a specific plate only ever proves it for that plate.
const FIXTURE = `
<div class="application app stonetop sheet actor steading">
  <div class="window-content">
    <img id="p-bare" src="${PIXEL}">
    <figure><img id="p-plate" src="${PIXEL}"></figure>
    <button class="stonetop-icon-btn"><img id="p-icon" src="${PIXEL}"></button>
    <img id="p-portrait" class="stonetop-actor-portrait-img" src="${PIXEL}">
  </div>
</div>`;

const PROPERTIES = ["border-top-width", "border-right-width", "border-bottom-width",
	"border-left-width", "box-shadow"];

const PROBES = Object.fromEntries(["bare", "plate", "icon", "portrait"]
	.map(name => [name, { selector: `#p-${name}`, properties: PROPERTIES }]));

describe.skipIf(!canProbe())("images on a Stonetop sheet carry no frame", () => {
	const seen = new Map();

	beforeAll(() => {
		for (const [k, v] of probe.render({ bodyHtml: FIXTURE, bodyClass: "game vtt theme-light", probes: PROBES }))
			seen.set(k, v);
	}, 120000);

	for (const name of ["bare", "plate", "icon", "portrait"]) {
		it(`draws no border on the ${name} image`, () => {
			const el = seen.get(name);
			for (const side of ["top", "right", "bottom", "left"]) {
				expect(el.get(`border-${side}-width`), `${name}: a ${side} border`).toBe("0px");
			}
		});

		// The one that kept being missed. `figure img` glows as well as borders, so an image inside a
		// figure still had a 4px black ring after every border was stripped — which on parchment reads
		// as exactly the frame this rule exists to remove.
		it(`casts no shadow around the ${name} image`, () => {
			expect(seen.get(name).get("box-shadow"), `${name}: a glow`).toBe("none");
		});
	}
});

// The render above proves the rule wins under the layer order the probe PINS. This proves it wins
// under the other one.
//
// A cascade layer takes its priority from where its name is first declared, and two stylesheets do
// not reliably finish parsing in document order — so `system`, the layer stonetop.css wraps itself
// in, is sometimes registered before core's ordering statement and becomes the LOWEST layer instead
// of the eighth. Every core rule then outranks ours. That race is why the frame kept coming back
// intermittently and why no amount of specificity inside the layer ever fixed it: specificity is not
// what was losing.
//
// An unlayered declaration outranks every layered one in either outcome. So the fix is structural,
// and so is the test: the rule has to sit AFTER the layer's closing brace. Rendered assertions cannot
// see this — the probe pins the good order, which is the order in which the bug is invisible.
describe("the image-frame reset is unlayered, so the layer-order race cannot reach it", () => {
	const css = readFileSync(path.join(STYLES, "stonetop.css"), "utf8");

	/** Where `@layer system { … }` ends: the brace that closes it, tracked by depth from its open. */
	const layerEnd = () => {
		const open = css.indexOf("@layer system {");
		expect(open, "stonetop.css no longer opens an @layer system block").toBeGreaterThan(-1);
		let depth = 0;
		for (let i = css.indexOf("{", open); i < css.length; i++) {
			if (css[i] === "{") depth++;
			else if (css[i] === "}" && --depth === 0) return i;
		}
		throw new Error("@layer system is never closed");
	};

	// The bare `img` selector, not one of the `img[src*=…]` filter rules that share its prefix.
	const resetAt = () => {
		const at = css.search(/^\.stonetop\.sheet img\s*[,{]/m);
		expect(at, "the image-frame reset is gone entirely").toBeGreaterThan(-1);
		return at;
	};

	it("declares the reset after the layer closes", () => {
		expect(resetAt(), "the image-frame reset moved back inside @layer system, where core beats it")
			.toBeGreaterThan(layerEnd());
	});

	// Core's own escape hatch clears border AND box-shadow; a reset that clears only the border
	// leaves the 4px glow that `figure img` draws, which is the same frame by another name.
	it("clears the shadow as well as the border", () => {
		const rule = css.slice(resetAt());
		const body = rule.slice(rule.indexOf("{"), rule.indexOf("}"));
		expect(body).toContain("border: none");
		expect(body).toContain("box-shadow: none");
	});
});
