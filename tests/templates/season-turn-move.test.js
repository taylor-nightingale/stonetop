import { describe, it, expect, beforeEach } from "vitest";
import { renderPartial } from "../fakes/renderTemplate.js";
import { SeasonProcedure } from "../../src/model/data/steading/SeasonProcedure.js";

// The turn panel used to state the procedure as a one-line gloss while the three seasons NOT being
// rolled showed their full text further down — the move being performed was the one move on the tab
// you could not read. It renders through the same row as every other move now, open, which also puts
// "whoever is most content rolls +Fortunes" on screen: who picks up the dice is an instruction, and
// no control on this sheet was saying it.

const SUMMER = {
	slug:        "seasons-change-summer",
	name:        "Seasons Change: Summer",
	ownedId:     "owned-summer",
	rollStat:    "fortunes",
	description: "When **_the hot days of summer settle_**, whoever is most content rolls +Fortunes…",
	gloss:       "the hot days of summer settle",
	selection:   { value: 1, max: 1 },
};

const context = editable => ({
	editable,
	sheetIdPrefix: "sheet-1",
	stonetop: { fortunesReset: 1 },
	seasons: {
		moves:     { key: "seasons" },
		nextMove:  SUMMER,
		// The move's own procedure, which is where the turn control's roll button now lives — summer
		// rolls +Fortunes for its tiers, and rolling that is what turns the wheel.
		procedure: SeasonProcedure.from({ steps: [{ kind: "roll", stat: "fortunes", tiers: true }] }),
		turnover:  { next: { key: "summer", labelKey: "summer" }, season: { labelKey: "spring" }, year: 3 },
	},
});

let html;
beforeEach(() => { html = renderPartial("stonetop.steading-season-turn", context(true)); });

describe("the turn panel's season move", () => {
	it("renders the incoming season's move as a move row", () => {
		expect(html).toContain('data-move-slug="seasons-change-summer"');
		expect(html).toContain("Seasons Change: Summer");
	});

	// The move's text IS the procedure, so it is on screen without anyone opening anything.
	it("ships the row open", () => {
		expect(html).toContain('aria-expanded="true"');
		expect(html).toMatch(/class="stonetop-move-body"[^>]*>/);
		expect(html).not.toMatch(/class="stonetop-move-body"[^>]*hidden/);
		expect(html).toContain("whoever is most content rolls +Fortunes");
	});

	// The row half of the disclosure's state — Disclosure sets `is-open` there when a reader toggles
	// one, so a row the template ships open has to say so itself or the caret points the wrong way.
	it("marks the row open", () => {
		expect(html).toMatch(/<li class="[^"]*is-open[^"]*"/);
	});

	// Two controls, two different acts. The button above rolls this move AND turns the wheel; the
	// row's own die rolls it and leaves the wheel where it stands — which a table re-rolling a
	// season's move, or reading what it does, is entitled to. Every move the sheet draws goes through
	// the same row, so every move the sheet draws rolls.
	it("keeps the row's own die alongside the turn control", () => {
		expect(html).toContain('class="rollable move-rollable"');
		expect(html).toContain('data-action="turnSeason"');
	});

	// A locked sheet still reads the procedure; it just cannot turn the season.
	it("still shows the move when the sheet is not editable", () => {
		const locked = renderPartial("stonetop.steading-season-turn", context(false));
		expect(locked).toContain("Seasons Change: Summer");
		expect(locked).not.toContain('data-action="turnSeason"');
	});
});
