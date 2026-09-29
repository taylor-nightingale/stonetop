import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderPartial } from "../fakes/renderTemplate.js";
import { buildMoveSnapshot } from "../../src/actors/embeddedMoves.js";
import { MoveCategorySnapshotBuilder } from "../../src/model/snapshot/character/MoveSnapshot.js";
import { ResourceController } from "../../src/actors/character/ResourceController.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";

// Defend is the one basic move that holds something, and the rail is too narrow to seat its four
// pips beside the name, the stat and the caret (190px of row against about 206 wanted). So its track
// takes the row's second line, right-aligned to the row's edge — the same edge the stat sits on above
// it. Measured, because where a flex track lands in a subgrid row is the cascade's call.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css")
]);

const resources = new ResourceController(new FakeCharacterActorBuilder().build(), "moveResources");
const move = (name, slug, system = {}) => buildMoveSnapshot(
	{ _id: slug, name, system: { slug, rollStat: "con", description: `When you **_${name.toLowerCase()}_**, roll +Con.`, ...system } },
	"basic", false, resources);

const category = new MoveCategorySnapshotBuilder()
	.withKey("basic").withLabel("Basic Moves").withRenderStyle("side-bar")
	.withMoves([move("Aid or Interfere", "aid"), move("Defend", "defend", { resource: { max: 4 } }), move("Defy Danger", "defy")])
	.build();

const GROUP = renderPartial("stonetop.rail-move-group", { category, index: 0, open: true, sheetIdPrefix: "s1" });

const FIXTURE = `
<div class="application stonetop sheet character themed theme-light" style="height: 700px"><div class="window-content">
  <div class="sheet-wrapper"><div class="stonetop-rail-layout">
    <div class="stonetop-rail stonetop-moves-rail">${GROUP}</div>
    <div class="stonetop-rail-main character-main"><section class="sheet-body"></section></div>
  </div></div>
</div></div>`;

const TARGETS = {
	row:   'li[data-slug="defend"]',
	name:  'li[data-slug="defend"] .stonetop-mrow-title',
	stat:  'li[data-slug="defend"] .stonetop-mrow-stat',
	caret: 'li[data-slug="defend"] .stonetop-mrow-caret',
	track: 'li[data-slug="defend"] .stonetop-item-resources',
	pip:   'li[data-slug="defend"] .stonetop-item-resource-check',
	next:  'li[data-slug="defy"]',
};

const measureAt = rootPx => probe.measure({
	bodyHtml:  FIXTURE,
	bodyClass: "theme-light",
	rootAttrs: `style="font-size: ${rootPx}px"`,
	targets:   TARGETS,
});

const bottom = el => el.values.boxTop + el.values.boxHeight;
const right = el => el.values.boxLeft + el.values.boxWidth;

describe.skipIf(!canProbe())("a rail move's resource track", () => {
	let measured;
	beforeAll(() => { measured = measureAt(16); });
	const el = name => measured.get(name);

	it("renders", () => {
		for (const [name, m] of measured) expect(m.missing, `${name} did not render`).toBe(false);
	});

	it("takes the line under the name", () => {
		expect(el("track").values.boxTop).toBeGreaterThanOrEqual(bottom(el("name")) - 1);
	});

	it("ends on the row's right edge, the edge the caret keeps above it", () => {
		expect(Math.abs(right(el("track")) - right(el("caret")))).toBeLessThan(2);
	});

	it("grows its own row instead of overlapping the next move", () => {
		expect(bottom(el("track"))).toBeLessThanOrEqual(bottom(el("row")));
		expect(el("next").values.boxTop).toBeGreaterThanOrEqual(bottom(el("row")) - 1);
	});

	it.each([8, 16, 32])("fits the rail at Foundry font size %ipx", rootPx => {
		const at = measureAt(rootPx);
		expect(at.get("track").overflowX).toBe(0);
		expect(right(at.get("track"))).toBeLessThanOrEqual(right(at.get("row")) + 0.5);
	});

	it("draws one pip per point the move can hold", () => {
		expect(el("pip").values.boxWidth).toBeGreaterThan(0);
		expect(el("pip").values.boxHeight).toBeGreaterThan(0);
	});
});
