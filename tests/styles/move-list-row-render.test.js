import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderPartial } from "../fakes/renderTemplate.js";
import { buildMoveSnapshot } from "../../src/actors/embeddedMoves.js";
import { MoveCategorySnapshotBuilder } from "../../src/model/snapshot/character/MoveSnapshot.js";
import { ResourceController } from "../../src/actors/character/ResourceController.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";

// The move row, its panel and its bar, in real Chrome under core's stylesheet — the character's rail and
// the steading's draw the same partials under the same rules, so the rail's claims hold in both.

const STYLES = path.resolve("styles");
const SHEETS = ["themes/palette.css", "themes/parchment-light.css", "themes/parchment-dark.css", "tokens.css", "stonetop.css"]
	.map(f => path.join(STYLES, f));
const probe = new RenderProbe(SHEETS);

const resources = new ResourceController(new FakeCharacterActorBuilder().build(), "moveResources");
const move = (name, slug, system = {}) => buildMoveSnapshot(
	{ _id: slug, name, system: { slug, description: `When you **_${name.toLowerCase()}_**, roll.`, ...system } },
	"basic", false, resources);

const MOVES = [
	move("Defy Danger", "defy", { rollStat: "ask" }),
	move("Persuade (vs. NPCs)", "persuade", { rollStat: "cha" }),
	move("Defend", "defend", { rollStat: "con", resource: { max: 4 } }),
	move("Recover", "recover"),
];

const category = new MoveCategorySnapshotBuilder()
	.withKey("basic").withLabel("Basic Moves").withRenderStyle("side-bar").withMoves(MOVES).build();

const group = open => renderPartial("stonetop.rail-move-group", { category, index: 1, open, sheetIdPrefix: "s1" });

// Opened as the sheet opens it: the body shown, the gloss hidden, the row marked.
const openRow = (html, slug) => html
	.replace(new RegExp(`(<li class="stonetop-mrow[^"]*)(" data-disclosure-row data-slug="${slug}")`), "$1 is-open$2")
	.replace(`id="s1-move-basic-${slug}" hidden`, `id="s1-move-basic-${slug}"`)
	.replace(/(data-slug="recover"[\s\S]*?class="stonetop-move-gloss" data-disclosure-shut)/, "$1 hidden");

const RAILS = {
	character: { rail: "stonetop-moves-rail", main: "character-main" },
	steading:  { rail: "steading-rail",       main: "steading-main" },
};

// Wide enough that the rail sits beside the sheet: at the browser's own width it is a drawer, which
// both sheets draw at one width, so a fixture there cannot see the rails' widths differ. The window
// holds the sheet, which core caps at the viewport.
const DOCKED = "1600px";
const WIDE = ["--window-size=1800,1000"];

const RAIL = (html, sheet = "character", width = "auto") => `
<div class="application stonetop sheet ${sheet} themed theme-light" style="width: ${width}; height: 900px"><div class="window-content">
  <div class="sheet-wrapper"><div class="stonetop-rail-layout">
    <div class="stonetop-rail ${RAILS[sheet].rail}">${html}</div>
    <div class="stonetop-rail-main ${RAILS[sheet].main}"><section class="sheet-body"></section></div>
  </div></div>
</div></div>`;

const TAB = html => `
<div class="application stonetop sheet character themed theme-light" style="width: 1100px"><div class="window-content">
  <section class="sheet-body" style="width: 1000px">${html}</section>
</div></div>`;

const row = slug => `li[data-slug="${slug}"]`;
const bottom = el => el.values.boxTop + el.values.boxHeight;
const right = el => el.values.boxLeft + el.values.boxWidth;

describe.skipIf(!canProbe()).each(Object.keys(RAILS))("the move row, in the %s's rail", sheet => {
	let m;
	beforeAll(() => {
		m = probe.measure({
			bodyHtml: RAIL(openRow(group(true), "recover"), sheet, DOCKED), bodyClass: "theme-light", chromeFlags: WIDE,
			targets: {
				defyStat:      `${row("defy")} .stonetop-mrow-stat`,
				persuadeStat:  `${row("persuade")} .stonetop-mrow-stat`,
				recoverStat:   `${row("recover")} .stonetop-mrow-stat`,
				persuadeName:  `${row("persuade")} .stonetop-mrow-title`,
				defyName:      `${row("defy")} .stonetop-mrow-title`,
				recoverName:   `${row("recover")} .stonetop-mrow-title`,
				recoverGloss:  `${row("recover")} .stonetop-move-gloss`,
				recoverText:   `${row("recover")} .stonetop-move-body .stonetop-item-description`,
				defyGloss:     `${row("defy")} .stonetop-move-gloss`,
			},
		});
	});

	it("renders", () => {
		for (const [name, el] of m) expect(el.missing, `${name} did not render`).toBe(false);
	});

	// The list owns the columns, so every row's stat sits in one column whatever its own row holds.
	it("lines every row's stat up in one column", () => {
		expect(m.get("persuadeStat").values.boxLeft).toBeCloseTo(m.get("defyStat").values.boxLeft, 0);
		expect(m.get("recoverStat").values.boxLeft).toBeCloseTo(m.get("defyStat").values.boxLeft, 0);
	});

	it("wraps a long name rather than running it into the stat", () => {
		const name = m.get("persuadeName");
		expect(name.overflowX).toBe(0);
		expect(right(name)).toBeLessThanOrEqual(m.get("persuadeStat").values.boxLeft);
	});

	// The die stands in front of a rolling name; a name that does not roll sits in from its cell by
	// the same width, so the two line up.
	it("lines a name that does not roll up with one that does", () => {
		expect(m.get("recoverName").textLeft).toBeCloseTo(m.get("defyName").textLeft, 0);
	});

	it("starts the trigger where the name's text starts", () => {
		expect(m.get("defyGloss").textLeft).toBeCloseTo(m.get("defyName").textLeft, 0);
	});

	it("puts the gloss away while the text is open", () => {
		expect(m.get("recoverGloss").values.boxHeight).toBe(0);
	});

	it("starts the open text where the name's text starts", () => {
		expect(m.get("recoverText").textLeft).toBeCloseTo(m.get("recoverName").textLeft, 0);
	});
});

// One row, one set of rules: a rule keyed on one sheet that reaches a part of the row would make the two
// rails draw the same partial two ways, which is the drift this row exists to end.
describe.skipIf(!canProbe()).each(["16px", "20px"])("the move row, the same in both rails, at a %s root", rootSize => {
	const PROPS = ["font-family", "font-size", "font-weight", "letter-spacing", "color", "background-color",
		"border-top-style", "border-top-color", "border-bottom-style", "width", "height", "min-width",
		"justify-content", "padding-left", "padding-top", "display", "opacity"];
	const PARTS = {
		panel:    ".stonetop-move-panel",
		bar:      ".stonetop-bar",
		barTitle: ".stonetop-bar-title",
		list:     ".stonetop-move-list",
		row:      row("defend"),
		header:   `${row("defend")} > .stonetop-item-header`,
		roll:     `${row("defend")} .stonetop-mrow-roll`,
		die:      `${row("defend")} .stonetop-mrow-die`,
		title:    `${row("defend")} .stonetop-mrow-title`,
		static:   `${row("recover")} .stonetop-mrow-title--static`,
		mod:      `${row("defend")} .stonetop-mrow-mod`,
		nil:      `${row("recover")} .stonetop-mrow-nil`,
		controls: `${row("defend")} .stonetop-item-controls`,
		caret:    `${row("defend")} .stonetop-mrow-caret`,
		chevron:  `${row("defend")} .stonetop-move-caret`,
		gloss:    `${row("defend")} .stonetop-move-gloss`,
		pip:      `${row("defend")} .stonetop-item-resource-check`,
		pipUsed:  `${row("defend")} .stonetop-item-resource-check.is-checked`,
		text:     `${row("recover")} .stonetop-move-body .stonetop-item-description`,
		card:     `${row("defend")} .stonetop-move-preview`,
	};
	const used = html => html.replace(/(class="[^"]*stonetop-item-resource-check)(")/, "$1 is-checked$2");
	// Core gives every button `transition: all`, so a loaded machine can read a pip mid-fade.
	const settled = "<style>* { transition: none !important; }</style>";
	const styled = sheet => probe.render({
		bodyHtml: settled + RAIL(used(openRow(group(true), "recover")), sheet, DOCKED), bodyClass: "theme-light",
		rootAttrs: `style="font-size: ${rootSize}"`, chromeFlags: WIDE,
		probes: Object.fromEntries(Object.entries(PARTS).map(([name, selector]) => [name, { selector, properties: PROPS }])),
	});

	let character, steading;
	beforeAll(() => { character = styled("character"); steading = styled("steading"); });

	it.each(Object.keys(PARTS))("styles the %s identically", part => {
		expect(character.get(part).missing, `${part} did not render`).toBe(false);
		expect(steading.get(part).values).toEqual(character.get(part).values);
	});
});

describe.skipIf(!canProbe())("the move row, in a wide list", () => {
	let m;
	beforeAll(() => {
		m = probe.measure({
			bodyHtml: TAB(group(true)), bodyClass: "theme-light",
			targets: {
				name:  `${row("defend")} .stonetop-mrow-title`,
				track: `${row("defend")} .stonetop-item-resources`,
				stat:  `${row("defend")} .stonetop-mrow-stat`,
			},
		});
	});

	// Where the row has room, the track joins the first line, past the stat.
	it("puts the track on the name's line", () => {
		expect(Math.abs(m.get("track").boxMiddle - m.get("name").firstLineMiddle)).toBeLessThan(6);
		expect(m.get("track").values.boxLeft).toBeGreaterThanOrEqual(right(m.get("stat")));
	});
});

describe.skipIf(!canProbe())("the ink bar", () => {
	let m, styles;
	beforeAll(() => {
		const bodyHtml = RAIL(group(true));
		m = probe.measure({
			bodyHtml, bodyClass: "theme-light",
			targets: { bar: ".stonetop-bar", toggle: ".stonetop-bar-toggle", panel: ".stonetop-panel" },
		});
		styles = probe.render({
			bodyHtml, bodyClass: "theme-light",
			probes: { ink: { selector: ".stonetop-bar", pseudo: "::before", properties: ["mask-image"] } },
		});
	});

	// Index 1 in its surface: the heavier of the two textures.
	it("wears the texture its place picks", () => {
		expect(styles.get("ink").get("mask-image")).toContain("rock-texture-long.png");
	});

	it("hangs its control past its bottom edge without growing", () => {
		expect(bottom(m.get("toggle"))).toBeGreaterThan(bottom(m.get("bar")));
		expect(m.get("bar").values.boxHeight).toBeLessThan(m.get("toggle").values.boxHeight);
	});

	it("sits out over the panel's rule", () => {
		expect(m.get("bar").values.boxLeft).toBeLessThan(m.get("panel").values.boxLeft + 1);
	});
});

describe.skipIf(!canProbe())("the hover card", () => {
	it("stays out of the list until it is shown", () => {
		const styles = probe.render({
			bodyHtml: RAIL(group(true)), bodyClass: "theme-light",
			probes: { card: { selector: `${row("defend")} .stonetop-move-preview`, properties: ["display"] } },
		});
		expect(styles.get("card").get("display")).toBe("none");
	});

	// Core's dark theme blurs behind `.window-content`, which makes it what a merely fixed card is placed
	// against and clipped by: the card landed the window's offset away from its row, cut off at its edge.
	describe("shown, inside a window that blurs behind its content", () => {
		const WINDOW = `<div style="position: absolute; left: 150px; top: 120px; width: 400px; height: 300px">${RAIL(group(true))}</div>`;
		const shown = WINDOW.replace("theme-light", "theme-dark") + `<script>
			const card = document.querySelector('${row("defend")} .stonetop-move-preview');
			card.style.setProperty("--move-preview-x", "600px");
			card.style.setProperty("--move-preview-y", "40px");
			card.showPopover();
		</script>`;

		it("is in that window — the hazard is real", () => {
			const styles = probe.render({
				bodyHtml: shown, bodyClass: "theme-dark",
				probes: { content: { selector: ".window-content", properties: ["backdrop-filter", "overflow"] } },
			});
			expect(styles.get("content").get("backdrop-filter")).toBe("blur(4px)");
			expect(styles.get("content").get("overflow")).toBe("hidden");
		});

		it("sits exactly where it was placed, outside the window, at its own size", () => {
			const card = probe.measure({ bodyHtml: shown, bodyClass: "theme-dark",
				targets: { card: `${row("defend")} .stonetop-move-preview` } }).get("card");
			expect([card.values.boxLeft, card.values.boxTop]).toEqual([600, 40]);
			expect(card.values.boxWidth).toBeGreaterThan(200);
		});
	});
});
