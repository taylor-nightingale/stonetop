import { describe, it, expect, beforeEach } from "vitest";
import { renderPartial } from "../fakes/renderTemplate.js";
import { SeasonProcedure } from "../../src/model/data/steading/SeasonProcedure.js";
import { buildSeasonSteps } from "../../src/model/snapshot/steading/SeasonStepSnapshot.js";

// The box has held the move's full text twice, and holds it neither way now. First OPEN at the top,
// above the numbered steps and describing the INCOMING season — text that ran into the list it
// introduced, about a season the steading was not in. Then as a collapsed reference row at the foot.
// Both were the move said twice: the steps ARE the move, broken into the controls a table works
// from, and the move's own words are one wheel segment away, where every season's are.
//
// So what the box owes is: the season it is, that season's steps, the move's own roll, and the
// control that ends the season. This file is those claims.

const AUTUMN = {
	slug:     "seasons-change-autumn",
	name:     "Seasons Change: Autumn",
	ownedId:  "owned-autumn",
	rollStat: "fortunes",
	// The words the box must NOT restate — they belong to the wheel's copy of this move.
	description: "When **_autumn falls_**, whoever is most determined rolls +Fortunes…",
};

// The move's own roll, and the one step every Seasons Change ends on. Built through
// `buildSeasonSteps` because the partial reads a step through its prototype getters: a hand-written
// object renders a numbered row with no control at all.
const PROCEDURE = SeasonProcedure.from({
	steps: [
		{ kind: "roll", stat: "fortunes", tiers: true, text: "Then, roll +Fortunes." },
		{ kind: "reset", target: "fortunes", text: "Whatever the result, reset Fortunes to +1." },
	],
});

const context = editable => {
	const built = buildSeasonSteps({ procedure: PROCEDURE, statement: null, applied: {}, pick: null });
	const seasons = {
		moves:       { key: "seasons" },
		currentMove: AUTUMN,
		steps:       built.steps,
		adjustments: built.adjustments,
		turnover: {
			season: { key: "autumn", labelKey: "autumn" },
			next:   { key: "winter", labelKey: "winter" },
			year:   3,
		},
	};
	return { editable, sheetIdPrefix: "sheet-1", stonetop: { fortunesReset: 1, seasons }, seasons };
};

const render = editable => renderPartial("stonetop.steading-season-box", context(editable));

let html;
beforeEach(() => { html = render(true); });

describe("the season box's move", () => {
	it("names the season the steading is in", () => {
		expect(html).toContain("Seasons Change: Autumn");
		expect(html).toContain('data-season="autumn"');
	});

	it("breaks that move into its steps", () => {
		expect(html).toContain("steading-turn-steps");
		expect(html).toContain("Then, roll +Fortunes.");
		expect(html).toContain("Reset to +1");
	});

	// The move's own roll — the 2d6+Fortunes with its tiers — is what the section rolls, and the only
	// thing on the tab that posts Seasons Change. Turning the wheel posts nothing.
	it("carries the move's own roll, addressed by slug", () => {
		expect(html).toContain("rollable move-rollable");
		expect(html).toContain('data-move-slug="seasons-change-autumn"');
		expect(html).toContain('data-roll="fortunes"');
	});

	// One rendering of the move's words, and it is the wheel's. A row here would be the same move
	// twice on one tab, once as prose and once as the steps that are it.
	it("draws no move row of its own", () => {
		expect(html).not.toContain("stonetop-item");
		expect(html).not.toContain("autumn falls");
	});
});

describe("the control that ends the season", () => {
	it("names the season that comes next, not the one the box is", () => {
		expect(html).toContain('data-action="turnSeason"');
		expect(html).toContain("winter");
	});

	// After the steps, because it is the one thing here that is not about the season they describe.
	it("sits below the steps", () => {
		expect(html.indexOf("steading-turn-steps")).toBeLessThan(html.indexOf("steading-season-advance"));
	});

	// A locked sheet still reads the whole procedure; it just cannot turn the season.
	it("is absent when the sheet is not editable", () => {
		const locked = render(false);
		expect(locked).toContain("Seasons Change: Autumn");
		expect(locked).not.toContain('data-action="turnSeason"');
	});
});
