import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { bandHtml, sheetWithBand, windowFor, withFoot } from "./bandFixture.js";

/**
 * The top band, measured (D7).
 *
 * The masthead across the top — the name and the playbook, the instinct and the appearance beside
 * them — the six stats with their brackets, the Ailments panel beside them, and the foot. The real
 * partial over a real snapshot, in German. Whether any of it lines up is a question only a renderer
 * answers: a grid is as valid with tracks too narrow for their contents as with tracks that fit.
 */
const STYLES = path.resolve(process.cwd(), "styles");
const probe = new RenderProbe(["themes/palette.css", "themes/parchment-light.css", "themes/parchment-dark.css", "tokens.css", "stonetop.css"]
	.map(f => path.join(STYLES, f)));

const TARGETS = {
	band: "#s1-band", bandBox: ".stonetop-band",
	masthead: ".stonetop-masthead", name: ".stonetop-masthead .charname",
	who: ".stonetop-who", instinct: ".stonetop-instinct", instinctRoute: ".stonetop-instinct .stonetop-goto",
	appearance: ".stonetop-appearance",
	column: ".stonetop-stats-column",
	statsRow: ".stonetop-stats-row", debilities: ".stonetop-debilities",
	toggle: ".stonetop-top-toggle", toggleLabel: ".stonetop-top-toggle-label", tabs: ".sheet-tabs", firstTab: ".sheet-tabs .item",
	foot: ".stonetop-band-foot",
	mode: ".stonetop-band-foot > .stonetop-rollmode",
	rule: ".stonetop-band-foot .stonetop-rollmode-rule",
	heading: ".stonetop-stats-column .stonetop-move-group-title",
	headingRule: ".stonetop-stats-column .stonetop-panel-divider",

	str: '.stonetop-stat[data-stat="str"]', dex: '.stonetop-stat[data-stat="dex"]',
	cha: '.stonetop-stat[data-stat="cha"]',
	strRoll: '.stonetop-stat[data-stat="str"] .stonetop-stat-roll',
	chaRoll: '.stonetop-stat[data-stat="cha"] .stonetop-stat-roll',

	weakened: ".stonetop-debility:nth-child(1)",
	weakenedTick: ".stonetop-debility:nth-child(1) .stonetop-debility-check",
	weakenedArt: ".stonetop-debility:nth-child(1) .stonetop-debility-divider",
	weakenedName: ".stonetop-debility:nth-child(1) .stonetop-debility-label",
	weakenedEffect: ".stonetop-debility:nth-child(1) .stonetop-debility-effect",
	miserable: ".stonetop-debility:nth-child(3)",

	ailments: ".stonetop-ailments",
	ailmentBar: ".stonetop-ailments .stonetop-bar",
	ailmentList: ".stonetop-ailment-list",
	add: ".stonetop-ailments-edit",
	firstAilment: ".stonetop-ailment:nth-child(1)",
	firstNote: ".stonetop-ailment:nth-child(1) .stonetop-ailment-note",
	woundRow: ".stonetop-ailment--wound",
	woundName: ".stonetop-ailment--wound .stonetop-ailment-name",
	woundState: ".stonetop-ailment--wound .stonetop-ailment-note",

	rail: ".stonetop-rail", layout: ".stonetop-rail-layout",
};

const right = v => v.boxLeft + v.boxWidth;
// The character column's inset (1.5rem at the 16px root these render at): the band's content ends
// there, as the tab strip's and the tab's do.
const INSET = 24;
const bottom = v => v.boxTop + v.boxHeight;
const centreY = v => v.boxTop + v.boxHeight / 2;

// `still`: the rail made a drawer by its container query starts its slide out once the page is laid
// out, and a probe under load measured it mid-way, still a column.
const measure = ({ width = 1160, band = bandHtml(), wrapper = "", layout = "", targets = TARGETS, still = false } = {}) => probe.measure({
	bodyHtml: sheetWithBand({ width, band, wrapper, layout }), bodyClass: "game themed theme-light",
	rootAttrs: 'style="font-size: 16px"', targets,
	chromeFlags: [...windowFor(width), ...(still ? ["--force-prefers-reduced-motion"] : [])],
});

describe.skipIf(!canProbe())("the top band", () => {
	let m;
	beforeAll(() => { m = measure(); });
	const el = name => m.get(name).values;

	it("renders every part of the band", () => {
		for (const [name, probed] of m) expect(probed.missing, `${name} did not render`).toBe(false);
	});

	it("puts the band beside the rail, not inside it", () => {
		expect(el("band").boxLeft).toBeGreaterThanOrEqual(right(el("rail")) - 1);
	});

	// ── The grid ──────────────────────────────────────────────────────────────────
	it("sets the masthead across the top, the numbers under it, the ailments beside them", () => {
		expect(el("band").boxTop).toBeGreaterThanOrEqual(bottom(el("masthead")) - 1);
		expect(el("ailments").boxLeft).toBeGreaterThan(right(el("statsRow")));
		expect(el("ailments").boxTop).toBeGreaterThanOrEqual(bottom(el("masthead")) - 1);
	});

	// The masthead runs on the band's own columns, so the instinct starts where the panel under it
	// starts and the name where the stats do.
	it("lines the instinct up with the ailments panel, and the name with the stats", () => {
		expect(el("who").boxLeft).toBeCloseTo(el("ailments").boxLeft, 0);
		expect(el("name").boxLeft).toBeLessThanOrEqual(el("statsRow").boxLeft + 1);
	});

	// Reported: with one ailment the panel sat at the foot of its cell, a gap above it. It starts
	// where the stats do, its bar level with their heading, however few rows it has.
	it("starts the ailments at the top of the numbers beside them", () => {
		expect(el("ailments").boxTop).toBeCloseTo(el("column").boxTop, 0);
	});

	// Reported: the Ailments bar sat on the masthead's rule. It stands off it by what the masthead
	// leaves above it, and the stats' heading comes down with it, so the two stay level.
	it("stands the ailments off the masthead's rule by the masthead's own padding", () => {
		expect(el("ailments").boxTop - bottom(el("masthead"))).toBeCloseTo(0.4 * 16, 0);
		expect(el("column").boxTop - bottom(el("masthead"))).toBeCloseTo(0.4 * 16, 0);
	});

	it("keeps the ailments inside the band", () => {
		expect(right(el("ailments"))).toBeLessThanOrEqual(right(el("bandBox")));
		expect(bottom(el("ailments"))).toBeLessThanOrEqual(bottom(el("bandBox")));
	});

	// ── The masthead's two readouts ───────────────────────────────────────────────
	// One line each, cut to "…": a wrapped line grew the band on every narrow sheet.
	it("holds the instinct and the appearance to a line each", () => {
		const line = n => el(n).boxHeight;
		expect(line("instinct")).toBeLessThan(1.6 * 16);
		expect(line("appearance")).toBeLessThan(1.6 * 16);
		expect(right(el("instinctRoute"))).toBeLessThanOrEqual(right(el("bandBox")));
		expect(right(el("appearance"))).toBeLessThanOrEqual(right(el("bandBox")));
	});

	// ── The stats, as they were ───────────────────────────────────────────────────
	it("draws all six stats on one line, each at the declared frame width", () => {
		const tops = ["str", "dex", "cha"].map(n => el(n).boxTop);
		expect(Math.max(...tops) - Math.min(...tops), "the stats wrapped").toBeLessThan(2);

		const declaredW = parseFloat(probe.render({
			bodyHtml: sheetWithBand(), bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			probes: { tile: { selector: ".stonetop-stat", properties: ["--stat-frame-w"] } },
			chromeFlags: windowFor(1160),
		}).get("tile").get("--stat-frame-w")) * 16;
		for (const name of ["str", "dex", "cha"])
			expect(el(name).boxWidth, `${name} is not the declared frame width`).toBeCloseTo(declaredW, 0);
	});

	it("does not narrow the moves rail when the stat frames shrink", () => {
		expect(el("rail").boxWidth, "the rail followed the frames down").toBeGreaterThan(2 * el("str").boxWidth + 48);
	});

	it("makes the debility bands exactly as wide as the stats row", () => {
		expect(el("debilities").boxWidth).toBeCloseTo(el("statsRow").boxWidth, 0);
	});

	it("lands each debility band under its own pair of tiles", () => {
		expect(el("weakenedArt").boxLeft).toBeGreaterThanOrEqual(el("str").boxLeft - 2);
		expect(right(el("weakenedArt"))).toBeLessThanOrEqual(right(el("dex")) + 2);
	});

	it("keeps every label inside the tile it names", () => {
		for (const [label, tile] of [["strRoll", "str"], ["chaRoll", "cha"]]) {
			expect(el(label).boxLeft).toBeGreaterThanOrEqual(el(tile).boxLeft - 1);
			expect(right(el(label))).toBeLessThanOrEqual(right(el(tile)) + 1);
		}
	});

	it("crops no label", () => {
		for (const name of ["strRoll", "chaRoll", "weakenedName"]) {
			expect(m.get(name).overflowX, `${name} is cropped horizontally`).toBe(0);
			expect(m.get(name).overflowY, `${name} is cropped vertically`).toBe(0);
		}
	});

	it("says what a marked debility does without drawing it", () => {
		expect(el("weakenedEffect").boxWidth).toBeLessThan(3);
		expect(el("weakenedArt").boxHeight).toBeCloseTo(18, 0);
	});

	it("keeps the three bands one height, marked or not", () => {
		expect(el("miserable").boxHeight).toBeCloseTo(el("weakened").boxHeight, 0);
	});

	it("sits each tick in the gap its bracket leaves, on the rule", () => {
		const art = el("weakenedArt"), tick = el("weakenedTick");
		expect(Math.abs((tick.boxLeft + tick.boxWidth / 2) - (art.boxLeft + art.boxWidth / 2))).toBeLessThanOrEqual(0.5);
		const ruleY = parseFloat(probe.render({
			bodyHtml: sheetWithBand(), bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			probes: { band: { selector: ".stonetop-debility-band", properties: ["--debility-rule-y"] } },
			chromeFlags: windowFor(1160),
		}).get("band").get("--debility-rule-y")) / 100;
		expect(Math.abs(centreY(tick) - (art.boxTop + art.boxHeight * ruleY))).toBeLessThanOrEqual(0.5);
	});

	it("spaces every block in the column by the same gap", () => {
		const gaps = [
			el("statsRow").boxTop - bottom(el("headingRule")),
			el("debilities").boxTop - bottom(el("statsRow")),
		];
		expect(Math.max(...gaps) - Math.min(...gaps), `uneven: ${gaps.map(g => g.toFixed(1))}`).toBeLessThan(1);
	});

	it("starts the heading at the top of the column it heads", () => {
		expect(el("heading").boxTop - el("column").boxTop).toBeLessThan(1);
	});

	// ── The foot, beside the stats ────────────────────────────────────────────────
	it("sets the foot beside the stats, under the ailments, ending the band's right edge", () => {
		expect(el("foot").boxLeft).toBeGreaterThan(right(el("statsRow")));
		expect(el("foot").boxTop).toBeGreaterThanOrEqual(bottom(el("ailments")) - 1);
		expect(right(el("toggle"))).toBeCloseTo(right(el("bandBox")) - INSET, 0);
	});

	it("rides the foot line, level with the roll mode", () => {
		const within = (v, box) => v >= box.boxTop && v <= bottom(box);
		expect(within(centreY(el("toggle")), el("mode"))).toBe(true);
		expect(el("toggle").boxLeft).toBeGreaterThanOrEqual(right(el("mode")));
	});

	it("keeps the Advantage/Disadvantage ? on the mode's own line", () => {
		const within = (v, box) => v >= box.boxTop && v <= bottom(box);
		expect(within(centreY(el("rule")), el("mode"))).toBe(true);
	});

	it("sits the fold control inside the band, clear of its rule", () => {
		expect(bottom(el("toggle"))).toBeLessThan(bottom(el("bandBox")));
	});

	it("covers no tab", () => {
		expect(bottom(el("toggle"))).toBeLessThanOrEqual(el("firstTab").boxTop);
	});

	// ── Ailments ──────────────────────────────────────────────────────────────────
	it("gives each ailment one line", () => {
		expect(el("firstAilment").boxHeight).toBeLessThan(1.6 * 16);
		expect(el("woundRow").boxHeight).toBeLessThan(1.6 * 16);
	});

	it("cuts a debility's sentence rather than wrapping it", () => {
		expect(right(el("firstNote"))).toBeLessThanOrEqual(right(el("ailmentList")));
		expect(el("firstNote").boxHeight).toBeLessThan(1.6 * 16);
	});

	// The state sits where a move row's roll does, so the right edges line up down the list.
	it("sets a wound's state against the list's right edge", () => {
		expect(right(el("woundState"))).toBeGreaterThan(right(el("ailmentList")) - 12);
	});

	// A bar's controls hang from it like cloth: from its top edge to past its bottom.
	it("hangs the + from the ailments' bar", () => {
		expect(el("add").boxTop).toBeLessThanOrEqual(el("ailmentBar").boxTop + 1);
		expect(bottom(el("add"))).toBeGreaterThan(bottom(el("ailmentBar")));
	});
});

describe.skipIf(!canProbe())("the wound editor", () => {
	let m;
	const targets = {
		...TARGETS,
		editor: ".stonetop-ailment-editor", editorName: ".stonetop-ailment-edit-name",
		editorState: ".stonetop-ailment-state", editorAdd: ".stonetop-ailment-add",
	};
	beforeAll(() => { m = measure({ band: bandHtml({ ailmentsOpen: true }), targets }); });
	const el = name => m.get(name).values;

	it("opens over the tab rather than inside the band", () => {
		expect(el("bandBox").boxHeight).toBeCloseTo(measure().get("bandBox").values.boxHeight, 0);
	});

	// Reported: it opened a few spaces below the panel. The stats beside it are the taller column,
	// and their extra height went into the panel's row, so the editor hung from the row, not the panel.
	it("hangs from the panel's bottom edge, however tall the stats beside it are", () => {
		expect(bottom(el("column")), "the fixture's stats must be the taller column").toBeGreaterThan(bottom(el("ailments")) + 8);
		expect(el("editor").boxTop).toBeCloseTo(bottom(el("ailments")), 0);
	});

	it("is the panel's width, so it reads as the panel's", () => {
		expect(el("editor").boxLeft).toBeCloseTo(el("ailments").boxLeft, 0);
		expect(right(el("editor"))).toBeCloseTo(right(el("ailments")), 0);
	});

	it("is drawn whole, not clipped by the panel", () => {
		expect(m.get("editor").overflowY).toBe(0);
		expect(el("editorAdd").boxHeight).toBeGreaterThan(8);
	});

	it("keeps a wound's name to a line of the list", () => {
		expect(el("editorName").boxHeight).toBeLessThan(1.7 * 16);
	});

	it("sets each wound's name and state on one row", () => {
		expect(Math.abs(centreY(el("editorName")) - centreY(el("editorState")))).toBeLessThan(3);
	});
});

// ── Short of room: the foot keeps to its column ────────────────────────────────────
// It never goes under the stats. BandFootFit first drops the fold control's word (compact), and
// where even that does not fit, the line wraps inside its own column (wrapped, which is compact too).

const beside = (v, why) => {
	expect(v("foot").boxLeft, `${why}: the foot is not beside the stats`).toBeGreaterThan(right(v("statsRow")));
	expect(v("mode").boxLeft, `${why}: the roll mode runs out of its column over the stats`).toBeGreaterThanOrEqual(v("foot").boxLeft - 0.5);
	expect(bottom(v("foot")), `${why}: the foot hangs below the stats`).toBeLessThanOrEqual(bottom(v("band")) + 1);
};

describe.skipIf(!canProbe())("the foot, compact", () => {
	let m, whole;
	beforeAll(() => {
		m = measure({ band: withFoot(bandHtml(), "is-foot-compact") });
		whole = measure();
	});
	const el = name => m.get(name).values;

	it("drops the fold control's word, keeping its caret", () => {
		expect(el("toggleLabel").boxWidth).toBe(0);
		expect(el("toggle").boxWidth).toBeGreaterThan(0);
		expect(el("toggle").boxWidth).toBeLessThan(whole.get("toggle").values.boxWidth);
	});

	it("keeps the foot beside the stats, on one line, ending the band's right edge", () => {
		beside(el, "compact");
		const within = (v, box) => v >= box.boxTop && v <= bottom(box);
		expect(within(centreY(el("toggle")), el("mode"))).toBe(true);
		expect(right(el("toggle"))).toBeCloseTo(right(el("bandBox")) - INSET, 0);
	});
});

// German fits compact at the floor (198px of 202), so no shipped language wraps yet. This is one that
// would: "Normal" said at length, at the sheet's 47rem floor, the compact line ~280px in 202.
describe.skipIf(!canProbe())("the foot, wrapped", () => {
	const LONG = 'class="stonetop-rollmode-label">Gewöhnlich gewürfelt<';
	let m;
	beforeAll(() => {
		const band = bandHtml().replace('class="stonetop-rollmode-label">Normal<', LONG);
		expect(band).toContain(LONG);
		m = measure({ width: 752, band: withFoot(band, "is-foot-compact", "is-foot-wrapped") });
	});
	const el = name => m.get(name).values;

	it("breaks the line inside its own column, the caret under the roll mode, still beside the stats", () => {
		beside(el, "wrapped");
		expect(right(el("mode")), "the roll mode runs out of its column on the right").toBeLessThanOrEqual(right(el("foot")) + 0.5);
		expect(el("toggle").boxTop).toBeGreaterThanOrEqual(bottom(el("mode")) - 1);
		expect(right(el("toggle"))).toBeCloseTo(right(el("bandBox")) - INSET, 0);
	});
});

// The widths the plan was measured against: in English, the compact line fits beside the stats at
// the narrowest a column rail leaves, and at the sheet's own floor with the rail a drawer. German
// needs more — "Vorteil", "Nachteil" — and is what the wrap is for; English must not need it.
describe.skipIf(!canProbe())("the foot at the narrowest the sheet gets, in English", () => {
	const floor = () => parseFloat(probe.render({
		bodyHtml: `<div class="application stonetop sheet actor character themed theme-light" id="floor" style="height: 100px"></div>`,
		bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
		probes: { floor: { selector: "#floor", properties: ["min-width"] } },
	}).get("floor").get("min-width"));
	const english = (...classes) => withFoot(bandHtml({ lang: "en" }), ...classes);

	it("keeps the whole line at the default width", () => {
		const m = measure({ band: english() });
		beside(n => m.get(n).values, "1160px");
	});

	it("keeps the compact line beside the stats at the sheet's floor, the rail a drawer", () => {
		const width = floor();
		expect(width).toBeGreaterThan(0);
		const m = measure({ width, band: english("is-foot-compact") });
		const v = n => m.get(n).values;
		expect(m.get("rail").values.boxLeft + m.get("rail").values.boxWidth, "the rail is still a column at the floor")
			.toBeLessThanOrEqual(v("layout").boxLeft + 0.5);
		expect(right(v("statsRow")), `the stats row overruns the band at ${width}px`).toBeLessThanOrEqual(right(v("bandBox")) + 1);
		beside(v, `${width}px`);
	});

	// 62.5rem is where the rail stops being a drawer: 1000px of layout at the 16px root, which the
	// window's own padding makes a 1035px sheet.
	it("keeps the compact line beside the stats at the narrowest a column rail leaves", () => {
		const m = measure({ width: 1035, band: english("is-foot-compact") });
		const v = n => m.get(n).values;
		expect(v("layout").boxWidth, "not the narrowest column layout").toBeGreaterThan(1000);
		expect(v("layout").boxWidth, "not the narrowest column layout").toBeLessThan(1002);
		expect(v("band").boxLeft, "the rail is a drawer at this width").toBeGreaterThanOrEqual(right(v("rail")) - 1);
		beside(v, "narrowest column");
	});

	it("makes the rail a drawer just below it", () => {
		const m = measure({ width: 1033, band: english("is-foot-compact"), still: true });
		const v = n => m.get(n).values;
		expect(v("layout").boxWidth).toBeLessThan(1000);
		expect(right(v("rail")), "the rail is still a column below 62.5rem").toBeLessThanOrEqual(v("layout").boxLeft + 0.5);
	});
});

// The rail's slide, on the character: the column beside a moving rail is held at the width it has
// with the rail shut, so the band and the tab are laid out once per slide rather than every frame.
// Three frames each way — the rail in, halfway, out — set by hand, since the probe paints no motion.
describe.skipIf(!canProbe())("the column while the rail slides", () => {
	const railAt = (html, px) => html.replace('class="stonetop-rail stonetop-moves-rail"', `class="stonetop-rail stonetop-moves-rail" style="margin-left: ${px}px"`);
	const targets = { ...TARGETS, main: ".character-main" };
	const at = (layout, px) => probe.measure({
		bodyHtml: railAt(sheetWithBand({ width: 1160, layout }), px), bodyClass: "game themed theme-light",
		rootAttrs: 'style="font-size: 16px"', targets, chromeFlags: windowFor(1160),
	});
	let rest, frames;
	beforeAll(() => {
		rest = measure({ layout: "rail-shut", targets });
		const W = rest.get("rail").values.boxWidth;
		frames = [0, -W / 2, -W].flatMap(px => [at("rail-shut is-rail-moving", px), at("is-rail-moving", px)]);
	});
	const v = (m, name) => m.get(name).values;

	it("holds the column and the band at their shut-rail sizes at every frame", () => {
		for (const m of frames) {
			expect(v(m, "main").boxWidth, "the column changed width mid-slide").toBeCloseTo(v(rest, "main").boxWidth, 0);
			expect(v(m, "bandBox").boxHeight, "the band changed height mid-slide").toBeCloseTo(v(rest, "bandBox").boxHeight, 0);
		}
	});

	it("slides the column with the rail", () => {
		for (const m of frames) expect(v(m, "main").boxLeft).toBeCloseTo(right(v(m, "rail")), 0);
	});
});
