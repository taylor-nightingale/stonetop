import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { SeasonalGains, SeasonalPicks } from "../../src/model/data/steading/SeasonalPicks.js";
import { SeasonProcedure } from "../../src/model/data/steading/SeasonProcedure.js";
import { SteadingMoveCategories } from "../../src/model/data/steading/SteadingMoveCategories.js";

const SRC_DIR    = path.resolve("packs/src/moves/seasons");
const FOLDER_SRC = path.resolve("packs/src/moves/_folders/seasons.json");

// Spring, summer and autumn each let the steading pick a seasonal gain, so each prints the list.
// Winter grants no gains (Book I, p.85) — it consumes Surplus instead.
const GAIN_SEASONS = ["spring", "summer", "autumn"];
const ALL_SEASONS  = [...GAIN_SEASONS, "winter"];

async function loadSeason(season) {
	const raw = await fs.readFile(path.join(SRC_DIR, `seasons-change-${season}.json`), "utf8");
	return JSON.parse(raw);
}

let moves;
let folder;
beforeAll(async () => {
	moves = Object.fromEntries(await Promise.all(
		ALL_SEASONS.map(async s => [s, await loadSeason(s)]),
	));
	folder = JSON.parse(await fs.readFile(FOLDER_SRC, "utf8"));
});

describe("Seasons Change moves", () => {
	it.each(ALL_SEASONS)("%s is a seasons move that rolls +Fortunes", season => {
		const move = moves[season];
		expect(move.type).toBe("move");
		expect(move.system.moveType).toBe("seasons");
		expect(move.system.rollStat).toBe("fortunes");
		expect(move.system.slug).toBe(`seasons-change-${season}`);
	});

	// The moveType groups them on the steading sheet; the folder groups them in the compendium.
	// A move filed under the homefront folder would read as a homefront move to anyone browsing.
	it.each(ALL_SEASONS)("%s sits in the seasons compendium folder", season => {
		expect(moves[season].folder).toBe(folder._id);
	});

	it("keys the seasons folder consistently with its id", () => {
		expect(folder._key).toBe(`!folders!${folder._id}`);
		expect(folder.type).toBe("Item");
	});

	it.each(ALL_SEASONS)("%s has all three result tiers", season => {
		const results = moves[season].system.moveResults;
		expect(Object.keys(results)).toEqual(["success", "partial", "failure"]);
		for (const tier of Object.values(results)) expect(tier.value.trim()).not.toBe("");
	});

	it("gives every season its own id", () => {
		const ids = ALL_SEASONS.map(s => moves[s]._id);
		expect(new Set(ids).size).toBe(ALL_SEASONS.length);
	});

	it.each(ALL_SEASONS)("%s keys itself consistently with its id", season => {
		expect(moves[season]._key).toBe(`!items!${moves[season]._id}`);
	});

	// The gains live twice over: as structured data for the first-session checklist, and as prose
	// on each move card (every other move card in the system is self-contained). Pin them together
	// so an edit to one side can't silently drift from the other.
	it.each(GAIN_SEASONS)("%s prints every seasonal gain from SeasonalGains", season => {
		const description = moves[season].system.description;
		for (const gain of SeasonalGains.all()) {
			expect(description).toContain(gain.name);
			expect(description).toContain(gain.text);
		}
	});

	it("does not offer seasonal gains in winter", () => {
		expect(moves.winter.system.description).not.toContain("seasonal gain");
	});

	// The procedure is data on the move. A season whose steps do not parse silently falls back to
	// "roll it" — the wheel still turns, but the season's own procedure is gone with no error.
	it.each(ALL_SEASONS)("%s carries a procedure that parses", season => {
		const procedure = SeasonProcedure.from(moves[season].system);
		expect(procedure.steps.length).toBeGreaterThan(1);
		expect(procedure.steps.map(s => s.kind)).toContain("roll");
	});

	// Every season's move is rolled, and its 10+/7-9/6- tiers belong to exactly one of its rolls.
	// Two would give the tab two controls that both turn the wheel.
	it.each(ALL_SEASONS)("%s has exactly one roll carrying its result tiers", season => {
		const rolls = SeasonProcedure.from(moves[season].system).steps.filter(s => s.isTieredRoll);
		expect(rolls).toHaveLength(1);
	});

	// Winter is TWO rolls with a choice between them, and the tiered one is the FOURTH thing it does.
	// The tab used to draw it as the one button at the top, and winter's opening 1d4+Population roll
	// — the one that decides what the season costs — had no control at all.
	it("opens winter on its own dice, with the tiered roll behind the consumption and the loss", () => {
		const steps = SeasonProcedure.from(moves.winter.system).steps;
		expect(steps.map(s => s.kind)).toEqual(["roll", "consume", "pick", "roll", "reset"]);
		expect(steps[0].die).toBe("1d4");
		expect(steps[0].stat).toBe("population");
		expect(steps[3].isTieredRoll).toBe(true);
	});

	// Summer's move gives 2 on a 10+; the sheet offered one for every season.
	it("offers two seasonal gains in summer and one in spring and autumn", () => {
		expect(SeasonProcedure.from(moves.summer.system).pick.count).toBe(2);
		for (const season of ["spring", "autumn"]) {
			expect(SeasonProcedure.from(moves[season].system).pick.count).toBe(1);
		}
	});

	// Winter grants no gains — it takes. Handing it the gains list read as a reward for the hardest
	// season of the year.
	it("picks from what winter takes, not from the gains", () => {
		expect(SeasonProcedure.from(moves.winter.system).pick.from).toBe("winter-losses");
		for (const season of GAIN_SEASONS) {
			expect(SeasonProcedure.from(moves[season].system).pick.from).toBe("seasonal-gains");
		}
	});

	// A step naming a list nothing provides renders a heading over an empty picker.
	it.each(ALL_SEASONS)("%s picks from a list the system actually has", season => {
		const pick = SeasonProcedure.from(moves[season].system).pick;
		expect(SeasonalPicks.byKey(pick.from)).not.toBeNull();
	});

	// The category names the four slugs to sort them spring → winter. A slug renamed in the packs
	// and not here wouldn't fail anything — the move would just quietly sort to the back.
	it("names exactly these slugs in the seasons category's reading order", () => {
		expect(SteadingMoveCategories.byKey("seasons").order)
			.toEqual(ALL_SEASONS.map(s => moves[s].system.slug));
	});
});
