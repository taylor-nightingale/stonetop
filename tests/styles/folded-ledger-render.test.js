import { describe, it, expect } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { sheetWithBand, windowFor } from "./bandFixture.js";

/**
 * The band's two densities, measured: the six stats and their conditions at full size, and the same
 * at line height once the band folds. Both are in the markup at every width and one class picks,
 * so whether the right one is on screen — and whether the line fits beside the mode and the fold
 * control — is a question only layout answers.
 *
 * The real band partial, in German (see bandFixture.js).
 */
const STYLES = path.resolve(process.cwd(), "styles");
const probe = new RenderProbe(["themes/palette.css", "themes/parchment-light.css", "themes/parchment-dark.css", "tokens.css", "stonetop.css"]
	.map(f => path.join(STYLES, f)));

const TARGETS = {
	ledger: ".stonetop-folded-ledger",
	pairs: ".stonetop-folded-ledger .stonetop-folded-pairs",
	firstPair: ".stonetop-folded-pair:nth-child(1)",
	firstPairStats: ".stonetop-folded-pair:nth-child(1) .stonetop-folded-stats",
	firstCond: ".stonetop-folded-pair:nth-child(1) .stonetop-folded-cond",
	lastCond: ".stonetop-folded-pair:last-child .stonetop-folded-cond",
	firstAbbr: ".stonetop-folded-pair:nth-child(1) .stonetop-folded-stat:first-child .stonetop-folded-abbr",
	firstValue: ".stonetop-folded-pair:nth-child(1) .stonetop-folded-stat:first-child .stonetop-folded-value",
	lineSr: ".stonetop-folded-sr",
	handle: ".stonetop-top-toggle",
	band: ".stonetop-band",
	mode: ".stonetop-band-foot > .stonetop-rollmode",
	bandStats: ".stonetop-stats-row",
	ailments: ".stonetop-ailments",
	tabs: ".sheet-tabs",
	masthead: ".stonetop-masthead",
	foot: ".stonetop-band-foot",
};

const measure = ({ folded, railShut = false, width, moving = false }) => probe.measure({
	bodyHtml: sheetWithBand({ width, wrapper: `${folded ? "top-collapsed" : ""} ${moving ? "is-band-moving" : ""}`, layout: railShut ? "rail-shut" : "" }),
	bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"', targets: TARGETS,
	chromeFlags: windowFor(width),
});

const shown = v => v.boxWidth > 0 && v.boxHeight > 0;
const showing = (m, name) => shown(m.get(name).values);
const right = v => v.boxLeft + v.boxWidth;
// The character column's inset (1.5rem at the 16px root these render at).
const INSET = 24;
const centre = v => v.boxTop + v.boxHeight / 2;
const within = (v, box) => v >= box.boxTop && v <= box.boxTop + box.boxHeight;

describe.skipIf(!canProbe())("the band and the line are two densities of one thing", () => {
	it("keeps the stats off the line while the band is showing them", () => {
		const m = measure({ folded: false, width: 1400 });
		expect(showing(m, "bandStats")).toBe(true);
		expect(showing(m, "pairs"), "both densities are on screen at once").toBe(false);
		expect(m.get("ledger").values.boxHeight, "the folded line is holding open a gap").toBe(0);
	});

	// Folding must not take a number off the sheet, or a condition with it.
	it("puts the stats and their conditions on the line the moment the band is folded", () => {
		const m = measure({ folded: true, width: 1400 });
		expect(showing(m, "bandStats"), "the band did not fold").toBe(false);
		expect(showing(m, "ailments"), "the ailments stayed on the folded band").toBe(false);
		expect(showing(m, "pairs"), "folding the band took the stats with it").toBe(true);
		expect(showing(m, "firstCond"), "folding the band took the conditions with it").toBe(true);
	});

	it("folds the band whatever the rail is doing", () => {
		for (const railShut of [false, true])
			expect(showing(measure({ folded: true, railShut, width: 1400 }), "pairs"), `railShut=${railShut}`).toBe(true);
	});

	// Measured at the last visible thing on the line, not as the line's overflow: each condition's
	// sentence is in the DOM for assistive tech, clipped to a pixel, and a Range still counts its words.
	it("keeps the line inside the sheet rather than spilling out of it", () => {
		const m = measure({ folded: true, railShut: true, width: 1400 });
		expect(right(m.get("lastCond").values)).toBeLessThanOrEqual(right(m.get("ledger").values) + 1);
		expect(right(m.get("ledger").values)).toBeLessThanOrEqual(right(m.get("band").values));
	});

	it("moves the tabs up when the band folds, never down", () => {
		const open = measure({ folded: false, width: 1400 }).get("tabs").values;
		const shut = measure({ folded: true, width: 1400 }).get("tabs").values;
		expect(shut.boxTop).toBeLessThan(open.boxTop);
	});
});

describe.skipIf(!canProbe())("the folded line", () => {
	// Which stats a condition hinders has to be knowable before it is marked: the condition follows
	// its pair on the line.
	it("sets each condition after the pair of stats it hinders, on the pair's line", () => {
		const m = measure({ folded: true, railShut: true, width: 1400 });
		const stats = m.get("firstPairStats").values, cond = m.get("firstCond").values;
		expect(cond.boxLeft).toBeGreaterThanOrEqual(right(stats));
		expect(within(centre(cond), stats)).toBe(true);
		expect(right(m.get("firstPair").values)).toBeGreaterThanOrEqual(right(cond));
	});

	// The air under the masthead's rule is the band's in both states, so the fold never snaps it in
	// or out: it would land a jump at the start of every fold's motion.
	it("stands off the masthead's rule by the same air as the band open", () => {
		const m = measure({ folded: true, width: 1400 });
		const mast = m.get("masthead").values;
		expect(m.get("foot").values.boxTop - (mast.boxTop + mast.boxHeight)).toBeCloseTo(0.4 * 16, 0);
	});

	it("keeps each abbreviation beside its own value", () => {
		const m = measure({ folded: true, width: 1400 });
		const abbr = m.get("firstAbbr").values, value = m.get("firstValue").values;
		expect(shown(abbr)).toBe(true);
		expect(abbr.boxLeft).toBeLessThan(value.boxLeft);
		expect(Math.abs(abbr.boxTop - value.boxTop)).toBeLessThanOrEqual(2);
	});

	it("puts the numbers and the mode on one line once there is room", () => {
		const m = measure({ folded: true, railShut: true, width: 1600 });
		const line = m.get("pairs").values, mode = m.get("mode").values;
		expect(within(centre(mode), line), "the mode is on its own row under the numbers").toBe(true);
		expect(mode.boxLeft).toBeGreaterThanOrEqual(right(line));
	});

	// Where there is not — at the sheet's floor — the NUMBERS take the second row and the two controls
	// stay put.
	it("wraps the numbers rather than the controls", () => {
		const m = measure({ folded: true, width: 720 });
		const ledger = m.get("ledger").values;
		expect(ledger.boxHeight, "the numbers did not take a second row").toBeGreaterThan(m.get("mode").values.boxHeight);
		expect(right(m.get("handle").values)).toBeCloseTo(right(m.get("band").values) - INSET, 0);
		expect(m.get("mode").values.boxLeft).toBeGreaterThanOrEqual(right(ledger));
	});

	it("keeps the folded line clear of the fold control", () => {
		const m = measure({ folded: true, railShut: true, width: 1400 });
		expect(right(m.get("lastCond").values)).toBeLessThanOrEqual(m.get("handle").values.boxLeft);
		expect(m.get("handle").overflowX).toBe(0);
	});

	it("keeps the one mode, and the handle, where they were when the band folds", () => {
		const open = measure({ folded: false, width: 1400 });
		const shut = measure({ folded: true, width: 1400 });
		for (const name of ["mode", "handle"]) {
			expect(showing(shut, name), `folding took the ${name} away`).toBe(true);
			expect(right(shut.get(name).values), `the ${name} moved sideways`).toBeCloseTo(right(open.get(name).values), 0);
		}
	});

	it("names the debility in text for a stat it has dimmed, clipped rather than removed", () => {
		expect(measure({ folded: true, width: 1400 }).get("lineSr").values.boxWidth).toBeLessThan(3);
	});
});

describe.skipIf(!canProbe())("the folded line's condition marks", () => {
	const probes = {
		marked:     { selector: ".stonetop-folded-pair:nth-child(1) .stonetop-cond-circle", properties: ["background-color", "width"] },
		unmarked:   { selector: ".stonetop-folded-pair:nth-child(2) .stonetop-cond-circle", properties: ["background-color"] },
		markedName: { selector: ".stonetop-folded-pair:nth-child(1) .stonetop-folded-cond", properties: ["color"] },
		otherName:  { selector: ".stonetop-folded-pair:nth-child(2) .stonetop-folded-cond", properties: ["color"] },
		input:      { selector: ".stonetop-folded-pair:nth-child(1) .stonetop-cond-check", properties: ["opacity"] },
	};
	const read = () => probe.render({
		bodyHtml: sheetWithBand({ wrapper: "top-collapsed" }), bodyClass: "game themed theme-light",
		rootAttrs: 'style="font-size: 16px"', probes, chromeFlags: windowFor(1160),
	});

	// The fixture marks Weakened, the first pair's.
	it("fills the marked condition's circle and names it in the warning ink", () => {
		const m = read();
		expect(m.get("marked").get("background-color")).not.toBe(m.get("unmarked").get("background-color"));
		expect(m.get("markedName").get("color")).not.toBe(m.get("otherName").get("color"));
		expect(parseFloat(m.get("marked").get("width"))).toBeGreaterThan(0);
	});

	it("draws the circle in place of the checkbox, which stays in the page for the keyboard", () => {
		expect(read().get("input").get("opacity")).toBe("0");
	});
});

// While BandFold eases the band, both densities are on the page: the one leaving and the one arriving.
describe.skipIf(!canProbe())("the band while it folds", () => {
	it("keeps the numbers and the ailments drawn while they ease away", () => {
		const m = measure({ folded: true, width: 1400, moving: true });
		expect(showing(m, "bandStats"), "the numbers vanished before easing away").toBe(true);
		expect(showing(m, "ailments"), "the ailments vanished before easing away").toBe(true);
		expect(showing(m, "pairs")).toBe(true);
	});

	it("keeps the line drawn while it eases out", () => {
		const m = measure({ folded: false, width: 1400, moving: true });
		expect(showing(m, "pairs"), "the line vanished before easing out").toBe(true);
	});
});
