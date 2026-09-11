import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderPartial } from "../fakes/renderTemplate.js";
import { SeasonProcedure } from "../../src/model/data/steading/SeasonProcedure.js";
import { buildSeasonSteps } from "../../src/model/snapshot/steading/SeasonStepSnapshot.js";

/**
 * The move's three results, drawn as the rows of a table under the roll they answer.
 *
 * They were one sentence holding all three tiers, which is how winter's second consumption ended up
 * as prose in the middle of a clause with no control on it — and then two different tables, one on
 * the move's own item sheet and one here, off the same authored field. They are one component now
 * (templates/actor/partials/move-result-row.hbs), and these are the claims about it that no text
 * scan of the stylesheet can answer, because each is a question about where the browser put the
 * boxes:
 *
 *  1. The three notations share a column, centred in it, so "10+ / 7-9 / 6-" line up and a reader
 *     finds the result they rolled by running down it rather than reading three sentences.
 *  2. The band is the full height of its row. That is what makes the block read as a table rather
 *     than as three paragraphs each wearing a chip.
 *  3. A result is a full sentence and wraps. Its second line stays in the text column, under the
 *     first, rather than running back under the band — and the row never pushes the box sideways.
 *  4. The row that costs a roll keeps its control INSIDE the row, at every font size the Font Size
 *     setting can produce, so the button belongs to the result that caused it.
 *  5. The row the dice landed on is lit, and the two it did not are still readable beside it.
 */
const STYLES = path.resolve(process.cwd(), "styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
]);

// Winter's own results, as the pack authors them — the 7-9 and the 6- each cost another roll.
const MOVE_RESULTS = {
	success: { label: "10+", value: "The winter is relatively mild, and each player can name a local NPC with whom their relationship improves at least a little (work together to figure out how)." },
	partial: { label: "7-9", value: "The steading must consume additional Surplus equal to 1d4+Population before winter ends or suffer the consequences as above." },
	failure: { label: "6-",  value: "As a 7-9, but also threats abound (and don't mark XP)." },
};

const STEP = {
	kind: "roll", stat: "fortunes", tiers: true, text: "Then, roll +Fortunes.",
	results: {
		partial: { die: "1d4", stat: "population", affects: "consumption" },
		failure: { die: "1d4", stat: "population", affects: "consumption" },
	},
};

// The rows as the sheet actually emits them: real snapshot, real partials. A hand-written fixture
// here would be a second description of the markup, and the one thing a render probe must not do is
// measure markup the app does not produce.
function boxHtml({ outcome = null } = {}) {
	const built = buildSeasonSteps({
		procedure: SeasonProcedure.from({ steps: [STEP], moveResults: MOVE_RESULTS }), outcome,
	});
	const seasons = {
		moves:       { key: "seasons" },
		currentMove: { slug: "seasons-change-winter", name: "Seasons Change: Winter" },
		steps:       built.steps,
		adjustments: built.adjustments,
		turnover:    { season: { key: "winter", labelKey: "winter" }, next: { key: "spring", labelKey: "spring" }, year: 3 },
	};
	return renderPartial("stonetop.steading-season-box",
		{ editable: true, sheetIdPrefix: "sheet-1", stonetop: { fortunesReset: 1, seasons }, seasons });
}

const fixture = (width, options = {}) => `
<div class="application stonetop sheet actor steading themed theme-light" style="width: ${width}px">
	<div class="window-content"><div class="sheet-wrapper">${boxHtml(options)}</div></div>
</div>`;

const row = key => `.stonetop-result-row--${key}`;

const TARGETS = {
	rows:          ".stonetop-result-rows",
	successRow:    row("success"),
	partialRow:    row("partial"),
	successLabel:  `${row("success")} .stonetop-result-notation`,
	partialLabel:  `${row("partial")} .stonetop-result-notation`,
	failureLabel:  `${row("failure")} .stonetop-result-notation`,
	successBand:   `${row("success")} .stonetop-result-label`,
	successText:   `${row("success")} .stonetop-result-text`,
	partialText:   `${row("partial")} .stonetop-result-text`,
	partialRoll:   `${row("partial")} .steading-turn-roll`,
	box:           ".steading-season-box",
};

describe.skipIf(!canProbe())("the result rows of the season's own roll", () => {
	let m;
	beforeAll(() => {
		m = probe.measure({ bodyHtml: fixture(560), targets: TARGETS });
	});

	// One column for the notation, so the eye runs down it instead of reading three sentences to find
	// the tier that was rolled. Centred in the band, so it is the notations' MIDDLE that lines up —
	// "10+" and "6-" are not the same width and never were.
	it("lines the three notations up on one column", () => {
		const middles = ["successLabel", "partialLabel", "failureLabel"]
			.map(k => m.get(k).textLeft + m.get(k).values.contentWidth / 2);
		expect(Math.max(...middles) - Math.min(...middles)).toBeLessThan(1);
	});

	// The band is the row, not a chip at the top of it: a tinted column down the left is what makes
	// three results read as one table.
	it("runs the band the full height of its row", () => {
		const band = m.get("successBand");
		const rowBox = m.get("successRow");
		expect(band.values.boxHeight).toBeGreaterThan(rowBox.values.boxHeight - 2);
		// And the result is taller than one line here, so the claim is not trivially true.
		expect(rowBox.values.boxHeight).toBeGreaterThan(m.get("successText").values.firstLineHeight * 1.5);
	});

	// A result is a sentence: its second line belongs under its first, not back under the band.
	it("keeps a wrapped result inside its own column", () => {
		const text = m.get("successText");
		expect(text.textLeft).toBeGreaterThan(m.get("successLabel").textLeft);
		expect(text.overflowsX).toBe(false);
		expect(text.values.boxHeight).toBeGreaterThan(text.values.firstLineHeight * 1.5);
	});

	// The button belongs to the result that caused it, so it has to be inside that result's row.
	it("keeps the control inside the row whose result costs it", () => {
		const rowBox = m.get("partialRow");
		const roll   = m.get("partialRoll");
		expect(roll.values.boxTop).toBeGreaterThan(m.get("partialText").values.boxTop);
		expect(roll.values.boxTop + roll.values.boxHeight)
			.toBeLessThanOrEqual(rowBox.values.boxTop + rowBox.values.boxHeight + 1);
		expect(roll.overflows).toBe(false);
	});

	it("never pushes the box sideways", () => {
		expect(m.get("rows").overflowsX).toBe(false);
		expect(m.get("box").overflowsX).toBe(false);
	});

	// The sheet's text is rem and Foundry's Font Size setting moves the root, so a row hand-fitted at
	// one size is a row that clips at another.
	it.each([["the smallest step", "font-size: 12px"], ["the largest", "font-size: 24px"]])(
		"survives %s of the Font Size setting", (_name, style) => {
			const at = probe.measure({ bodyHtml: fixture(560), rootAttrs: `style="${style}"`, targets: TARGETS });
			expect(at.get("partialText").overflowsX).toBe(false);
			expect(at.get("partialRoll").overflows).toBe(false);
			expect(at.get("box").overflowsX).toBe(false);
		});

	// The narrowest the sheet gets. A band that cannot shrink would squeeze the sentence into a
	// two-word ribbon rather than wrapping it.
	it("still reads in a narrow window", () => {
		const narrow = probe.measure({ bodyHtml: fixture(360), targets: TARGETS });
		expect(narrow.get("partialText").overflowsX).toBe(false);
		expect(narrow.get("box").overflowsX).toBe(false);
		expect(narrow.get("partialLabel").textLeft).toBeLessThan(narrow.get("partialText").textLeft);
	});
});

// What the roll did to the rows. The season keeps the tier its own move came up, and the row the
// dice landed on is the one the table is living with — so it is lit, and the two it is not are
// dimmed rather than hidden: a 7-9 means what it means partly because of the 10+ above it.
const COLOURS = {
	rolledBand:  { selector: `${row("partial")} .stonetop-result-label`, properties: ["background-color"] },
	rolledBody:  { selector: `${row("partial")} .stonetop-result-body`,  properties: ["background-color"] },
	rolledRow:   { selector: row("partial"), properties: ["opacity"] },
	quietBand:   { selector: `${row("success")} .stonetop-result-label`, properties: ["background-color"] },
	quietRow:    { selector: row("success"),  properties: ["opacity"] },
};

describe.skipIf(!canProbe())("the result the dice landed on", () => {
	let lit, none;
	beforeAll(() => {
		lit  = probe.render({ bodyHtml: fixture(560, { outcome: "partial" }), probes: COLOURS });
		none = probe.render({ bodyHtml: fixture(560), probes: COLOURS });
	});

	it("tints the row that was rolled more strongly than the rows that were not", () => {
		expect(lit.get("rolledBand").get("background-color"))
			.not.toBe(none.get("rolledBand").get("background-color"));
		expect(lit.get("rolledBody").get("background-color"))
			.not.toBe(lit.get("quietBand").get("background-color"));
	});

	it("holds the rolled row at full strength and recedes the others", () => {
		expect(Number(lit.get("rolledRow").get("opacity"))).toBe(1);
		expect(Number(lit.get("quietRow").get("opacity"))).toBeLessThan(1);
	});

	// Before anything is rolled there is no result to be living with, so all three read alike.
	it("leaves every row at full strength until the move is rolled", () => {
		expect(Number(none.get("rolledRow").get("opacity"))).toBe(1);
		expect(Number(none.get("quietRow").get("opacity"))).toBe(1);
	});
});
