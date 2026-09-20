import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderPartial } from "../fakes/renderTemplate.js";
import { MoveSnapshotBuilder } from "../../src/model/snapshot/character/MoveSnapshot.js";
import { ResourceBuilder } from "../../src/model/snapshot/ResourceSnapshot.js";
import { ValueMax } from "../../src/model/snapshot/character/VitalsSnapshot.js";

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

// The REAL row, rendered from the REAL partials. The sidebar used to hand-roll its own compact row,
// and this fixture hand-copied it — two descriptions of one thing, either of which could drift. The
// rail renders `move-group` disclosure rows now, like the steading's, so the fixture asks the
// partial for them and the drift is gone rather than merely watched for.
const resource = () => new ResourceBuilder()
	.withCurrent(2).withMax(4).withTitle("Readiness").withLabels([]).build();

const move = (name, slug, withTrack) => new MoveSnapshotBuilder()
	.withId(slug).withOwnedId(slug).withSlug(slug).withName(name).withNameless(false)
	.withDescription(`When you <em>${name.toLowerCase()}</em>, roll +Con.`)
	.withRollStat("con").withSource({ type: "reference" }).withSourceLabel(null)
	.withSelection(new ValueMax(1, 1)).withSelectable(false)
	.withRequirement(null).withRequiresLabel(null)
	.withResource(withTrack ? resource() : null)
	.withChoices(null).withSteps(null).withMoveResults(null).withRollNotes(null)
	.build();

// Exactly the parameters character.hbs passes: a rail group is unacquirable (a character HAS the
// basic moves) and always shows what a move holds.
const GROUP = renderPartial("stonetop.move-group", {
	title: "Basic Moves",
	moves: [move("Aid or Interfere", "aid", false), move("Defend", "defend", true), move("Defy Danger", "defy", false)],
	categoryKey: "basic",
	allowAdditional: false,
	alwaysShowResource: true,
	unacquirable: true,
	disclosure: true,
	sheetIdPrefix: "s1",
});

const FIXTURE = `
<div class="application stonetop sheet character themed theme-light" style="height: 700px"><div class="window-content">
  <div class="sheet-wrapper"><div class="stonetop-rail-layout" data-side="left">
    <div class="stonetop-rail stonetop-moves-rail">${GROUP}</div>
    <div class="stonetop-rail-main character-main"><section class="sheet-body"></section></div>
  </div></div>
</div></div>`;

// The middle row is Defend, the one that holds something. move-row emits `.stonetop-item`, and on a
// disclosure row the name is the button that opens the move's text.
const TARGETS = {
	row:   ".items-list > li:nth-child(2)",
	name:  ".items-list > li:nth-child(2) .stonetop-move-disclosure-name",
	track: ".items-list > li:nth-child(2) .stonetop-item-resources",
	pip:   ".items-list > li:nth-child(2) .stonetop-item-resource-check",
	next:  ".items-list > li:nth-child(3)",
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
	// In a hook, not the suite body: skipIf still runs the body, and the probe throws with no Foundry.
	let measured;
	beforeAll(() => { measured = measureAt(16); });
	const el = name => measured.get(name);

	it("renders", () => {
		for (const [name, m] of measured) expect(m.missing, `${name} did not render`).toBe(false);
	});

	// A disclosure row puts the controls — die, chat bubble, track — in one group on the name's own
	// line, so the gloss underneath can run the row's full width. The track used to hang on a line of
	// its own below the name, which is what the hand-rolled sidebar row did.
	it("rides the controls group on the name's line", () => {
		expect(Math.abs(el("track").values.boxTop - el("name").values.boxTop))
			.toBeLessThan(el("name").values.boxHeight);
	});

	// On that line it still has to stay clear of the name: the row's whole failure mode is a track
	// wide enough to sit on top of the word it belongs to.
	it("ends up right of the name rather than over it", () => {
		const name = el("name").values;
		expect(el("track").values.boxLeft).toBeGreaterThanOrEqual(name.boxLeft + name.boxWidth - 1);
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
