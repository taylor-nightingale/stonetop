import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { SeasonalGains } from "../../src/model/data/steading/SeasonalGains.js";
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

	// The category names the four slugs to sort them spring → winter. A slug renamed in the packs
	// and not here wouldn't fail anything — the move would just quietly sort to the back.
	it("names exactly these slugs in the seasons category's reading order", () => {
		expect(SteadingMoveCategories.byKey("seasons").order)
			.toEqual(ALL_SEASONS.map(s => moves[s].system.slug));
	});
});
