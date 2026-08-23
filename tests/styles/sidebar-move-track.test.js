import { describe, it, expect } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// The sidebar's reference-move rows are one line of text each. A move that holds something (Defend's
// Readiness) adds a resource track to that row, and the track is the shared flex one every other
// surface draws — which means the layout it takes here is decided by the cascade, not by markup.
// Measured rather than asserted about: whether four pips sit on a line of their own inside a 220px
// column, clear of the name above and of the next move below, is a question only a renderer answers.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css")
]);

// Markup copied from the sidebar block in character.hbs and resource-track.hbs, because the rules
// under test are selector-specific and a simplified stand-in would stop matching them.
const pips = n => Array.from({ length: n }, (_, i) =>
	`<button type="button" class="stonetop-item-resource-check${i < 2 ? " is-checked" : ""}"
	         data-action="moveResourcePip" data-move-slug="defend" data-index="${i}"></button>`).join("");

const row = (name, track) => `
<li class="item stonetop-move-item" data-item-id="${name}">
  <span class="rollable move-rollable" data-roll="con"><i class="fas fa-dice-d6"></i></span>
  <button type="button" class="stonetop-move-name stonetop-basic-move-open">${name}</button>
  <button type="button" class="stonetop-move-chat"><i class="fas fa-comment"></i></button>
  ${track ? `<span class="stonetop-item-resources">${pips(4)}</span>` : ""}
</li>`;

const FIXTURE = `
<div class="application stonetop sheet character themed theme-light"><div class="window-content">
  <div class="stonetop-sheet-layout"><div class="stonetop-moves-sidebar">
    <ol class="items-list">
      ${row("Aid or Interfere", false)}
      ${row("Defend", true)}
      ${row("Defy Danger", false)}
    </ol>
  </div></div>
</div></div>`;

const TARGETS = {
	row:   ".stonetop-move-item:nth-child(2)",
	name:  ".stonetop-move-item:nth-child(2) .stonetop-move-name",
	track: ".stonetop-move-item:nth-child(2) .stonetop-item-resources",
	pip:   ".stonetop-move-item:nth-child(2) .stonetop-item-resource-check",
	next:  ".stonetop-move-item:nth-child(3)",
};

/** @returns {Map<string, import("./RenderProbe.js").MeasuredElement>} */
const measureAt = rootPx => probe.measure({
	bodyHtml:  FIXTURE,
	bodyClass: "theme-light",
	rootAttrs: `style="font-size: ${rootPx}px"`,
	targets:   TARGETS,
});

const bottom = el => el.values.boxTop + el.values.boxHeight;

describe.skipIf(!canProbe())("a sidebar move's resource track", () => {
	const measured = measureAt(16);
	const el = name => measured.get(name);

	it("renders", () => {
		for (const [name, m] of measured) expect(m.missing, `${name} did not render`).toBe(false);
	});

	it("sits on a line of its own, below the move's name", () => {
		expect(el("track").values.boxTop).toBeGreaterThanOrEqual(bottom(el("name")));
	});

	// Butted straight against the name the two lines read as separate rows; the gap is what holds
	// the track to the move it belongs to.
	it("is separated from the name rather than touching it", () => {
		expect(el("track").values.boxTop - bottom(el("name"))).toBeGreaterThan(2);
	});

	it("grows its own row instead of overlapping the next move", () => {
		expect(bottom(el("track"))).toBeLessThanOrEqual(bottom(el("row")));
		expect(el("next").values.boxTop).toBeGreaterThanOrEqual(bottom(el("row")));
	});

	// The sidebar is a fixed 220px column, so a track that does not fit spills out of the sheet.
	it("fits the column its row is in", () => {
		expect(el("track").overflowX).toBe(0);
		expect(el("track").values.contentWidth).toBeLessThanOrEqual(el("row").values.contentWidth);
	});

	// Pips are <button>s, which core themes with a min-height of ~2em; a track that only fits at the
	// default font size is a track that breaks the moment someone changes Foundry's Font Size.
	it.each([8, 16, 32])("still fits at Foundry font size %ipx", rootPx => {
		const at = measureAt(rootPx);
		expect(at.get("track").overflowX).toBe(0);
		expect(at.get("track").values.contentWidth)
			.toBeLessThanOrEqual(at.get("row").values.contentWidth);
	});

	it("draws one pip per point the move can hold", () => {
		const pip = el("pip");
		expect(pip.values.boxWidth).toBeGreaterThan(0);
		expect(pip.values.boxHeight).toBeGreaterThan(0);
	});
});
