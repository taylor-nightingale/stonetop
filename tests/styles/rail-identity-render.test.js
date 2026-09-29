import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderPartial } from "../fakes/renderTemplate.js";
import { VitalsSnapshotBuilder, VitalsSourcesSnapshot, VitalsNotesSnapshot, ValueMax }
	from "../../src/model/snapshot/character/VitalsSnapshot.js";

// The head of the rail in real Chrome under core's stylesheet (D7, D9): the portrait with Armor, Level
// and Damage straddling its bottom edge, hit points and experience as bars, the edged boxes a
// conditional move arrives in, and the rail's toggle — a tab on the rail's edge that rides it as the
// rail slides out. None of it can be read off the stylesheet: a straddle is a transform against a
// box's own height, and a tab that stays on a moving edge is two transitions agreeing.

const STYLES = path.resolve("styles");
const SHEETS = ["themes/palette.css", "themes/parchment-light.css", "themes/parchment-dark.css", "tokens.css", "stonetop.css"]
	.map(f => path.join(STYLES, f));
const probe = new RenderProbe(SHEETS);

// The window has to be wider than the sheet, or the layout is a drawer whatever the sheet says.
const windowFor = width => [`--window-size=${width + 40},1000`];

// Font Awesome's own unlayered rule, standing in for the glyph the icon font would draw.
const FONT_AWESOME = `<style>.fas { display: inline-block; width: 1em; height: 1em; }</style>`;

const vitals = ({ hp = [13, 18], xp = [21, 16] } = {}) => new VitalsSnapshotBuilder()
	.withHp(new ValueMax(...hp))
	.withDamage({ value: "d6" })
	.withArmor(1)
	.withLevel(5)
	.withXp(new ValueMax(...xp))
	.withSources(new VitalsSourcesSnapshot("", "", ""))
	.withNotes(new VitalsNotesSnapshot("", "", ""))
	.build();

// Any real picture: an empty one collapses to its alt text. Resolved against the probe's base, styles/.
const PICTURE = "../assets/readme/followers.png";

const meter = (kind, m, extra = {}) => renderPartial("stonetop.rail-meter", {
	kind, label: kind.toUpperCase(), meter: m, valueAction: kind, valueLabel: kind, ...extra,
});

const railContents = ({ hp } = {}) => {
	const v = vitals({ hp });
	return `
	${renderPartial("stonetop.rail-identity", { stonetop: { vitals: v }, actor: { name: "Maelen", img: PICTURE }, sheetIdPrefix: "s1" })}
	${meter("hp", v.hpMeter, { maxAction: "maxHp", maxLabel: "max", tone: v.hpMeter.isLow ? "danger" : "life" })}
	<div class="stonetop-conditional stonetop-conditional--dire"><p>Death's Door</p></div>
	<div class="stonetop-rail-advancement">
		${meter("xp", v.xpTrack, { tone: "full", note: "ready to level · 5 spare" })}
		<div class="stonetop-conditional stonetop-conditional--ready"><p>Level Up</p></div>
		<div class="stonetop-conditional stonetop-conditional--spend">
			<p class="stonetop-conditional-label">Or spend it now</p><p>Burn Brightly</p>
		</div>
		<p class="stonetop-rail-route"><button type="button" class="stonetop-goto">End of Session</button></p>
	</div>`;
};

const SHEET = ({ width, state = "", hp } = {}) => `
${FONT_AWESOME}
<div class="application stonetop sheet actor character themed theme-light" style="width: ${width}px; height: 900px"><div class="window-content">
  <div class="sheet-wrapper"><div class="stonetop-rail-layout ${state}" style="height: 880px">
    <button type="button" class="stonetop-rail-toggle" data-action="toggleRail" aria-expanded="true" aria-label="Hide the rail">
      <i class="fas fa-chevron-left stonetop-rail-caret" aria-hidden="true"></i>
    </button>
    <div class="stonetop-rail stonetop-moves-rail" id="s1-moves-rail">${railContents({ hp })}</div>
    <div class="stonetop-rail-main character-main"><section class="sheet-body"><div class="tab active">Tab content</div></section></div>
  </div></div>
</div></div>`;

const TARGETS = {
	layout:    ".stonetop-rail-layout",
	toggle:    ".stonetop-rail-toggle",
	rail:      ".stonetop-rail",
	main:      ".stonetop-rail-main",
	content:   ".stonetop-rail-main .tab",
	frame:     ".stonetop-portrait-frame",
	portrait:  ".stonetop-portrait",
	cluster:   ".stonetop-cluster",
	armor:     ".stonetop-cluster-item--armor .stonetop-resource",
	level:     ".stonetop-cluster-item--level .stonetop-resource",
	damage:    ".stonetop-cluster-item--damage .stonetop-resource",
	levelLabel: ".stonetop-cluster-item--level .stonetop-resource__label",
	levelInput: ".stonetop-cluster-item--level .stonetop-resource__input",
	hp:        ".stonetop-meter--hp",
	hpBar:     ".stonetop-meter--hp .stonetop-meter-bar",
	hpGauge:   ".stonetop-meter--hp .stonetop-meter-gauge",
	hpFill:    ".stonetop-meter--hp .stonetop-meter-fill",
	hpInput:   ".stonetop-meter--hp .stonetop-meter-input",
	hpMax:     ".stonetop-meter--hp .stonetop-meter-input--max",
	hpFields:  ".stonetop-meter--hp .stonetop-meter-fields",
	hpDown:    ".stonetop-meter--hp .stonetop-stepper-btn--down",
	hpUp:      ".stonetop-meter--hp .stonetop-stepper-btn--up",
	xpGauge:   ".stonetop-meter--xp .stonetop-meter-gauge",
	xpFill:    ".stonetop-meter--xp .stonetop-meter-fill",
	xpTick:    ".stonetop-meter--xp .stonetop-meter-tick",
	xpOver:    ".stonetop-meter--xp .stonetop-meter-over",
};

const right = el => el.values.boxLeft + el.values.boxWidth;
const bottom = el => el.values.boxTop + el.values.boxHeight;
const REM = 16;

describe.skipIf(!canProbe())("the rail's identity", () => {
	let m;
	beforeAll(() => { m = probe.measure({ bodyHtml: SHEET({ width: 1100 }), bodyClass: "theme-light", targets: TARGETS, chromeFlags: windowFor(1100) }); });

	it("renders", () => {
		for (const [name, el] of m) expect(el.missing, `${name} did not render`).toBe(false);
	});

	it("sets Level on the portrait's bottom edge, half on and half off", () => {
		const frameBottom = bottom(m.get("frame"));
		expect(m.get("level").values.boxTop).toBeLessThan(frameBottom);
		expect(bottom(m.get("level"))).toBeGreaterThan(frameBottom);
	});

	it("flanks Level with Armor and Damage, dropped half a step so the three read as an arc", () => {
		const [armor, level, damage] = ["armor", "level", "damage"].map(k => m.get(k));
		expect(right(armor)).toBeLessThanOrEqual(level.values.boxLeft);
		expect(damage.values.boxLeft).toBeGreaterThanOrEqual(right(level));
		expect(armor.values.boxTop - level.values.boxTop).toBeCloseTo(0.5 * REM, 0);
		expect(damage.values.boxTop).toBeCloseTo(armor.values.boxTop, 0);
	});

	it("draws Level larger than the two beside it", () => {
		expect(m.get("level").values.boxWidth).toBeGreaterThan(m.get("armor").values.boxWidth);
		expect(m.get("level").values.boxHeight).toBeGreaterThan(m.get("armor").values.boxHeight);
	});

	it("centres the three under the portrait", () => {
		const frame = m.get("frame");
		const mid = frame.values.boxLeft + frame.values.boxWidth / 2;
		const level = m.get("level");
		expect(level.values.boxLeft + level.values.boxWidth / 2).toBeCloseTo(mid, 0);
	});

	it("puts each name on its tile's top rule", () => {
		const label = m.get("levelLabel");
		const top = m.get("level").values.boxTop;
		expect(label.values.boxTop).toBeLessThan(top);
		expect(bottom(label)).toBeGreaterThan(top);
	});

	it("keeps the value inside its tile", () => {
		const input = m.get("levelInput");
		const tile = m.get("level");
		expect(input.values.boxLeft).toBeGreaterThanOrEqual(tile.values.boxLeft);
		expect(right(input)).toBeLessThanOrEqual(right(tile) + 0.5);
	});

	it("leaves room under the portrait for the tiles it carries", () => {
		expect(m.get("hp").values.boxTop).toBeGreaterThanOrEqual(bottom(m.get("damage")));
	});

	it("frames the picture inside the rail, taller than wide and no taller than 13rem", () => {
		const portrait = m.get("portrait");
		expect(portrait.values.boxHeight).toBeGreaterThanOrEqual(portrait.values.boxWidth);
		expect(portrait.values.boxHeight).toBeLessThanOrEqual(13 * REM + 0.5);
		expect(right(m.get("frame"))).toBeLessThanOrEqual(right(m.get("rail")));
	});
});

describe.skipIf(!canProbe())("hit points and experience, as bars", () => {
	let m;
	beforeAll(() => { m = probe.measure({ bodyHtml: SHEET({ width: 1100 }), bodyClass: "theme-light", targets: TARGETS, chromeFlags: windowFor(1100) }); });

	// 13 of 18.
	it("fills hit points to the share left", () => {
		expect(m.get("hpFill").values.boxWidth / m.get("hpGauge").values.boxWidth).toBeCloseTo(0.72, 1);
	});

	it("keeps the value, its caps and the maximum on the bar", () => {
		const bar = m.get("hpBar");
		for (const k of ["hpInput", "hpDown", "hpUp", "hpMax"]) {
			const el = m.get(k);
			expect(el.values.boxLeft, k).toBeGreaterThanOrEqual(bar.values.boxLeft);
			expect(right(el), k).toBeLessThanOrEqual(right(bar));
			expect(el.values.boxTop, k).toBeGreaterThanOrEqual(bar.values.boxTop - 0.5);
			expect(bottom(el), k).toBeLessThanOrEqual(bottom(bar) + 0.5);
		}
	});

	// Drawn at rest, not only under the pointer; − and + either side of the numbers, never over them;
	// each the bar's full height and square to it.
	it("caps the bar with − and +, clear of the numbers", () => {
		const [down, up, fields, gauge, bar] = ["hpDown", "hpUp", "hpFields", "hpGauge", "hpBar"].map(k => m.get(k));
		expect(right(down)).toBeLessThanOrEqual(fields.values.boxLeft);
		expect(up.values.boxLeft).toBeGreaterThanOrEqual(right(fields));
		expect(right(down)).toBeLessThanOrEqual(gauge.values.boxLeft + 0.5);
		expect(up.values.boxLeft).toBeGreaterThanOrEqual(right(gauge) - 0.5);
		for (const cap of [down, up]) {
			expect(cap.values.boxHeight).toBeCloseTo(bar.values.boxHeight - 2, 0);
			expect(cap.values.boxWidth).toBeCloseTo(cap.values.boxHeight, 0);
		}
	});

	// 21 against a threshold of 16: the bar rescales to 21, so the mark is at 76% and the run past it
	// is the five spare.
	it("marks experience's threshold, and fills the run past it", () => {
		const gauge = m.get("xpGauge").values;
		expect((m.get("xpTick").values.boxLeft - gauge.boxLeft) / gauge.boxWidth).toBeCloseTo(0.76, 1);
		expect(m.get("xpOver").values.boxLeft).toBeCloseTo(m.get("xpTick").values.boxLeft, 0);
		expect(right(m.get("xpOver"))).toBeCloseTo(right(m.get("xpFill")), 0);
	});
});

describe.skipIf(!canProbe())("the bars' tones and the conditional edges", () => {
	let life, danger;
	const probes = {
		fill:   { selector: ".stonetop-meter--hp .stonetop-meter-fill", properties: ["background-color"] },
		input:  { selector: ".stonetop-meter--hp .stonetop-meter-input", properties: ["color"] },
		cap:    { selector: ".stonetop-meter--hp .stonetop-stepper-btn--up", properties: ["font-family"] },
		fields: { selector: ".stonetop-meter--hp .stonetop-meter-fields", properties: ["font-family"] },
		xpFill: { selector: ".stonetop-meter--xp .stonetop-meter-fill", properties: ["background-color"] },
		dire:   { selector: ".stonetop-conditional--dire", properties: ["border-left-width", "border-left-color"] },
		ready:  { selector: ".stonetop-conditional--ready", properties: ["border-left-width", "border-left-color"] },
		spend:  { selector: ".stonetop-conditional--spend", properties: ["border-left-width", "border-left-color"] },
		rail:   { selector: ".stonetop-rail", properties: ["background-color"] },
		main:   { selector: ".stonetop-rail-main", properties: ["background-color"] },
		frameArt: { selector: ".stonetop-portrait-frame", pseudo: "::before", properties: ["mask-image", "mask-size"] },
		portrait: { selector: ".stonetop-portrait", properties: ["border-top-width", "box-shadow"] },
		picture:  { selector: ".stonetop-portrait-frame > .stonetop-image-btn", properties: ["border-top-width", "border-top-style", "border-left-width", "box-shadow"] },
	};
	beforeAll(() => {
		life = probe.render({ bodyHtml: SHEET({ width: 1100 }), bodyClass: "theme-light", probes, chromeFlags: windowFor(1100) });
		danger = probe.render({ bodyHtml: SHEET({ width: 1100, hp: [3, 18] }), bodyClass: "theme-light", probes, chromeFlags: windowFor(1100) });
	});

	it("tints hit points one way while healthy and another once low, and says the low number in the warning ink", () => {
		expect(life.get("fill").values["background-color"]).not.toBe(danger.get("fill").values["background-color"]);
		expect(danger.get("input").values.color).not.toBe(life.get("input").values.color);
	});

	// The sheet's button face draws + as a flourish; the caps take the numbers' face instead.
	it("draws − and + in the numbers' face", () => {
		expect(life.get("cap").values["font-family"]).toBe(life.get("fields").values["font-family"]);
	});

	it("tints experience at the threshold unlike hit points", () => {
		expect(life.get("xpFill").values["background-color"]).not.toBe(life.get("fill").values["background-color"]);
	});

	it("sets each conditional apart by a heavy edge, one colour per kind of threshold", () => {
		const edges = ["dire", "ready", "spend"].map(k => life.get(k).values);
		for (const e of edges) expect(e["border-left-width"]).toBe("3px");
		expect(new Set(edges.map(e => e["border-left-color"])).size).toBe(3);
	});

	// Nine-sliced from frame-stat, as eight layers: Firefox never shipped mask-border.
	it("frames the portrait in the stat frame's slices, the corners unstretched", () => {
		const art = life.get("frameArt").values;
		expect(art["mask-image"].match(/frame-stat-(tl|tr|bl|br|top|bottom|left|right)\.png/g)).toHaveLength(8);
		expect(art["mask-size"].split(",").slice(0, 4).map(s => s.trim())).toEqual(["30px 30px", "30px 30px", "30px 30px", "30px 30px"]);
	});

	// Like every picture on these sheets, the portrait has no border: the frame is its only edge.
	it("draws no border round the portrait, and no glow", () => {
		const p = life.get("picture").values;
		expect([p["border-top-width"], p["border-left-width"]]).toEqual(["0px", "0px"]);
		expect(p["box-shadow"]).toBe("none");
		expect(life.get("portrait").values["border-top-width"]).toBe("0px");
	});

	it("sinks the rail's paper below the tab's", () => {
		const rail = life.get("rail").values["background-color"];
		expect(rail).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
	});
});

// Reported: a character with Foundry's default picture showed a dark brown square, off to one side of
// its frame. The theme's filter for core's white icons was darkening the paper drawn on the image, and
// the image sat in a button that shrank to it rather than filling the frame.
describe.skipIf(!canProbe())("the default portrait", () => {
	let m, looks;
	beforeAll(() => {
		const html = SHEET({ width: 1100 }).replace(PICTURE, "icons/svg/mystery-man.svg");
		m = probe.measure({ bodyHtml: html, bodyClass: "theme-light", targets: TARGETS, chromeFlags: windowFor(1100) });
		looks = probe.render({ bodyHtml: html, bodyClass: "theme-light", chromeFlags: windowFor(1100), probes: {
			portrait: { selector: ".stonetop-portrait", properties: ["background-color", "filter"] },
			picture:  { selector: ".stonetop-portrait-frame > .stonetop-image-btn", properties: ["background-color"] },
		} });
	});

	it("is still run through the theme's filter for core icons", () => {
		expect(looks.get("portrait").values.filter).not.toBe("none");
	});

	it("draws its paper behind the image, where the filter cannot darken it", () => {
		expect(looks.get("portrait").values["background-color"]).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
		expect(looks.get("picture").values["background-color"]).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
	});

	it("fills its frame, centred in it", () => {
		const frame = m.get("frame").values, img = m.get("portrait").values;
		const leftGap = img.boxLeft - frame.boxLeft, rightGap = right(m.get("frame")) - right(m.get("portrait"));
		expect(leftGap).toBeCloseTo(rightGap, 0);
		expect(leftGap).toBeLessThan(0.75 * REM);
	});
});

describe.skipIf(!canProbe())("the rail's toggle, a tab on the rail's edge", () => {
	const measure = (width, state) => probe.measure({ bodyHtml: SHEET({ width, state }), bodyClass: "theme-light", targets: TARGETS,
		chromeFlags: windowFor(width) });
	let open, shut, drawerShut, drawerOpen;
	beforeAll(() => {
		open = measure(1100, "");
		shut = measure(1100, "rail-shut");
		drawerShut = measure(800, "");
		drawerOpen = measure(800, "rail-open");
	});

	it("is a small tab, not a pill or a strip", () => {
		expect(open.get("toggle").values.boxWidth).toBeCloseTo(0.85 * REM, 0);
		expect(open.get("toggle").values.boxHeight).toBeCloseTo(2 * REM, 0);
		expect(shut.get("toggle").values.boxHeight).toBeCloseTo(2 * REM, 0);
	});

	// In the column's inset, which holds nothing: see sheet-alignment-render.test.js.
	it("rides the open rail's outer edge, beside the tab and over none of it", () => {
		expect(open.get("toggle").values.boxLeft).toBeCloseTo(right(open.get("rail")), 0);
		expect(right(open.get("toggle"))).toBeLessThanOrEqual(open.get("content").values.boxLeft);
	});

	// The same thing at two positions: the rail keeps its width and slides off, so no row re-wraps on
	// the way out, and the tab it leaves is still at the edge.
	it("slides a shut rail out whole, and the tab with it to the sheet's edge", () => {
		expect(shut.get("rail").values.boxWidth).toBeCloseTo(open.get("rail").values.boxWidth, 0);
		expect(right(shut.get("rail"))).toBeLessThanOrEqual(shut.get("layout").values.boxLeft + 0.5);
		expect(shut.get("toggle").values.boxLeft).toBeCloseTo(shut.get("layout").values.boxLeft, 0);
		expect(right(shut.get("toggle"))).toBeLessThanOrEqual(shut.get("content").values.boxLeft);
	});

	it("gives the tab the room the rail gave up", () => {
		expect(shut.get("main").values.boxWidth).toBeGreaterThan(open.get("main").values.boxWidth);
	});

	it("rides a drawer's edge the same way below the breakpoint", () => {
		expect(drawerShut.get("toggle").values.boxLeft).toBeCloseTo(drawerShut.get("layout").values.boxLeft, 0);
		expect(drawerOpen.get("toggle").values.boxLeft).toBeCloseTo(right(drawerOpen.get("rail")), 0);
		expect(right(drawerShut.get("toggle"))).toBeLessThanOrEqual(drawerShut.get("content").values.boxLeft);
	});
});

describe.skipIf(!canProbe())("the rail's motion", () => {
	const probes = {
		rail:   { selector: ".stonetop-rail", properties: ["transition-property", "transition-duration", "visibility"] },
		toggle: { selector: ".stonetop-rail-toggle", properties: ["transition-property", "transition-duration"] },
	};
	const read = (width, state, reduce = false) => probe.render({
		bodyHtml: SHEET({ width, state }), bodyClass: "theme-light", probes,
		chromeFlags: [...windowFor(width), ...(reduce ? ["--force-prefers-reduced-motion"] : [])],
	});
	const duration = (el, prop) => {
		const props = el.values["transition-property"].split(",").map(s => s.trim());
		const durations = el.values["transition-duration"].split(",").map(s => s.trim());
		const i = props.indexOf(prop);
		return i < 0 ? null : durations[i % durations.length];
	};

	it("moves the column and the tab on one 0.4s curve", () => {
		const m = read(1100, "rail-shut");
		expect(duration(m.get("rail"), "margin-left")).toBe("0.4s");
		expect(duration(m.get("toggle"), "left")).toBe("0.4s");
	});

	it("moves a drawer on the same curve", () => {
		const m = read(800, "rail-open");
		expect(duration(m.get("rail"), "transform")).toBe("0.4s");
		expect(duration(m.get("toggle"), "left")).toBe("0.4s");
	});

	// Off screen is not gone: a shut rail's fields would still take the focus.
	it("takes a shut rail out of reach, not only out of sight", () => {
		expect(read(1100, "rail-shut").get("rail").values.visibility).toBe("hidden");
		expect(read(800, "").get("rail").values.visibility).toBe("hidden");
		expect(read(1100, "").get("rail").values.visibility).toBe("visible");
	});

	it("does not move at all under reduced motion", () => {
		const m = read(1100, "rail-shut", true);
		expect(duration(m.get("rail"), "margin-left") ?? "0s").toBe("0s");
		expect(duration(m.get("toggle"), "left") ?? "0s").toBe("0s");
	});
});
