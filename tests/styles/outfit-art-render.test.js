import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// The outfitting figure is decoration on the Outfit rules, and it has to get out of the way when the
// sheet is too narrow to spare the width. That is a CONTAINER query — an actor window is resized
// independently of the browser viewport — so a viewport-based media query would never fire, and only
// rendering it at two container widths shows which one was written.

const STYLES = path.resolve("styles");
const sheet = (f) => path.join(STYLES, f);
const probe = new RenderProbe([
	sheet("themes/palette.css"), sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"), sheet("tokens.css"), sheet("stonetop.css"),
]);

// The outfit header row as tab-equipment.hbs emits it, in a sheet of a stated width.
//
// The width goes on `.application` itself, and overrides min-width: core makes it `position:
// absolute`, so it escapes any wrapper, and `.character` carries a 813px floor. Widths below are
// real ones — the floor, and the sheet's default.
const fixture = (px) => `
<div class="application stonetop sheet actor character" style="width:${px}px;min-width:${px}px">
  <div class="window-content">
    <div class="tab equipment">
      <div class="stonetop-outfit-headers" id="p-row">
        <div class="stonetop-outfit-header" id="p-rules">
          <img class="stonetop-outfit-art" id="p-art"
               src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" alt="" aria-hidden="true">
          <button type="button" class="stonetop-icon-btn stonetop-outfit-reset" id="p-reset">R</button>
          <p id="p-prose">When you <strong>Outfit</strong> for an expedition, mark a number of ◇ below.</p>
        </div>
        <div class="stonetop-prosperity-panel" id="p-prosperity"><p>Prosperity</p></div>
      </div>
    </div>
  </div>
</div>`;

const PROBES = {
	art:        { selector: "#p-art",        properties: ["display", "position"] },
	reset:      { selector: "#p-reset",      properties: ["display"] },
	rules:      { selector: "#p-rules",      properties: ["display"] },
	prosperity: { selector: "#p-prosperity", properties: ["display"] },
	row:        { selector: "#p-row",        properties: ["container-type", "display"] },
};

describe.skipIf(!canProbe())("the outfitting figure on the Outfit rules", () => {
	const wide = new Map(), narrow = new Map();
	let measuredWide;

	beforeAll(() => {
		for (const [into, width] of [[wide, 1160], [narrow, 813]]) {
			for (const [k, v] of probe.render({ bodyHtml: fixture(width), bodyClass: "game vtt theme-light", probes: PROBES })) into.set(k, v);
		}
		measuredWide = probe.measure({
			bodyHtml: fixture(1160), bodyClass: "game vtt theme-light",
			targets: { art: "#p-art", reset: "#p-reset", rules: "#p-rules", prose: "#p-prose" },
		});
	}, 120000);

	it("renders on a sheet at its default width", () => {
		expect(wide.get("art").missing).toBe(false);
		expect(wide.get("art").get("display")).not.toBe("none");
	});

	// 813px is `.character`'s floor — the narrowest the sheet can be dragged.
	it("drops out once the sheet is at its narrowest", () => {
		expect(narrow.get("art").get("display")).toBe("none");
	});

	// The rules and the Prosperity table carry the actual content — they never give way.
	it("never takes width from the panels that carry the rules", () => {
		for (const view of [wide, narrow]) {
			expect(view.get("rules").get("display")).not.toBe("none");
			expect(view.get("prosperity").get("display")).not.toBe("none");
		}
	});

	// A media query here would key off the browser window, which is not what resizes.
	it("responds to the sheet's own width, not the viewport's", () => {
		expect(wide.get("row").get("container-type")).toBe("inline-size");
	});

	it("sits inside the Outfit panel rather than beside the Prosperity table", () => {
		expect(wide.get("art").get("position")).toBe("absolute");
	});

	// A float hangs from the top of the panel, which is exactly where the reset control sits.
	it("never covers the reset control", () => {
		const art = measuredWide.get("art").values, reset = measuredWide.get("reset").values;
		const overlaps = art.boxLeft < reset.boxLeft + reset.boxWidth
			&& art.boxLeft + art.boxWidth > reset.boxLeft
			&& art.boxTop < reset.boxTop + reset.boxHeight
			&& art.boxTop + art.boxHeight > reset.boxTop;
		expect(overlaps).toBe(false);
	});

	// The panel reserves the figure's width with padding, so the rules never run underneath it.
	// Measured against the PROSE, not the panel: the panel's content box contains the figure too.
	it("does not overlap the rules it decorates", () => {
		const art = measuredWide.get("art").values, prose = measuredWide.get("prose").values;
		expect(art.boxLeft).toBeGreaterThanOrEqual(prose.boxLeft + prose.boxWidth - 1);
	});
});
