import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { StepAdjustment } from "../../src/model/data/steading/ImprovementEffect.js";
import { SeasonProcedure } from "../../src/model/data/steading/SeasonProcedure.js";
import { Seasons } from "../../src/model/data/steading/Seasons.js";

// What bends a step of the season is authored on the improvement itself. Six improvements bend one,
// at three different places, and the sheet renders each
// differently — so a bend authored without saying WHERE it hooks would be drawn as the wrong kind.

const ROOT = path.resolve("packs/src/steading-improvements");
const DIRS = ["stonetop", "additional"];

let adjusting;
let outcomeGated;
let procedures;
let bySlug;
let winterSteps;

beforeAll(async () => {
	const docs = [];
	for (const dir of DIRS) {
		const files = (await fs.readdir(path.join(ROOT, dir))).filter(f => f.endsWith(".json"));
		for (const file of files.sort()) {
			docs.push(JSON.parse(await fs.readFile(path.join(ROOT, dir, file), "utf8")));
		}
	}
	adjusting = docs.flatMap(doc => (doc.system.effects ?? [])
		.filter(effect => effect.adjustment)
		.map(effect => ({ slug: doc.system.slug, name: doc.name, ...effect })));
	outcomeGated = docs.flatMap(doc => (doc.system.effects ?? [])
		.filter(effect => effect.outcome)
		.map(effect => ({ slug: doc.system.slug, ...effect })));
	bySlug = Object.fromEntries(docs.map(doc => [doc.system.slug, doc]));

	winterSteps = JSON.parse(await fs.readFile(
		path.resolve("packs/src/moves/seasons", "seasons-change-winter.json"), "utf8")).system.steps;

	procedures = Object.fromEntries(await Promise.all(Seasons.all().map(async season => {
		const raw = await fs.readFile(
			path.resolve("packs/src/moves/seasons", `${season.moveSlug}.json`), "utf8");
		return [season.key, SeasonProcedure.from(JSON.parse(raw).system)];
	})));
});

describe("the improvements that bend a step", () => {
	// The five the book has. Named rather than counted, so a sixth authored by hand shows up here as a
	// decision to make rather than as a number that quietly moved.
	//
	// Township is deliberately NOT among them. Its "roll 2d6+Population instead of 1d4+Population" is
	// the book's SIZE table — a hamlet consumes 1d2+Population, a village 1d4, a town 2d6 — which the
	// winter move now carries on the step itself. Modelled here, a steading that shrank to a hamlet
	// had nothing saying so, and a town that reached its Size some other way rolled a village's dice.
	it("are the five the book bends a season with", () => {
		expect(adjusting.map(a => a.slug).sort()).toEqual([
			"additional-housing", "golden-sapling", "great-wood-timber",
			"permanent-logging-camp", "stone-wall",
		]);
	});

	it("each state where in the step they hook", () => {
		for (const { name, adjustment } of adjusting) {
			expect(["formula", "term", "result"], name).toContain(adjustment.at);
		}
	});

	// A formula adjustment carries the pair rollSeasonStep takes — never a formula string, which
	// nothing resolves and which would skip the debilities the rating goes through.
	it("give a formula adjustment its dice and its rating", () => {
		for (const { name, adjustment } of adjusting.filter(a => a.adjustment.at === "formula")) {
			expect(adjustment.die, name).toMatch(/^\d*d\d+/);
			expect(StepAdjustment.fromRaw(adjustment).stat, name).not.toBeNull();
			expect(adjustment.replaceFormula, name).toBeUndefined();
		}
	});

	it("give a term adjustment the rating it bends and by how much", () => {
		for (const { name, adjustment } of adjusting.filter(a => a.adjustment.at === "term")) {
			expect(StepAdjustment.fromRaw(adjustment).term, name).not.toBeNull();
			expect(Number.isInteger(adjustment.amount), name).toBe(true);
		}
	});

	it("give a result adjustment the amount it changes", () => {
		for (const { name, adjustment } of adjusting.filter(a => a.adjustment.at === "result")) {
			expect(Number.isInteger(adjustment.amount), name).toBe(true);
		}
	});

	// The join: a bend names a side of the season, and the seasons moves name the same sides on their
	// own steps. One that fires in a season with no such step is stated in the general list instead —
	// true of the Golden Sapling, and of nothing else.
	it("find a step in every season they fire in, bar the sapling's", () => {
		const homeless = adjusting.flatMap(({ slug, adjustment, when }) => {
			const seasons = when?.seasons?.length ? when.seasons : Seasons.all().map(s => s.key);
			return seasons
				.filter(key => procedures[key].indexFor(adjustment.step) === null)
				.map(key => `${slug} in ${key}`);
		});
		expect(homeless).toEqual([
			"golden-sapling in spring", "golden-sapling in winter",
		]);
	});
});

// The other half of the Township decision above. The clause is still the book's, so it still reads on
// the improvement — but it fires nowhere: a turn trigger would put it in winter's own panel, restating
// dice the step has already rolled, under a heading for what the steading still owes.
describe("the winter dice a town rolls", () => {
	it("are the winter move's own, by size", () => {
		const roll = winterSteps.find(step => step.kind === "roll" && step.affects === "consumption");
		expect(roll.dieBySize).toEqual({ hamlet: "1d2", village: "1d4", town: "2d6" });
	});

	it("are never a result Township fires at the turn of a season", () => {
		const turning = (bySlug["township"].system.effects ?? []).filter(e => e.when?.kind === "turn");
		expect(turning.map(e => e.text)).toEqual([
			"the town generates Surplus equal to Population+1",
		]);
	});

	// Stated on the improvement all the same, in the book's own voice: a completion clause carrying its
	// own "when" is what ImprovementPayoff files under Henceforth, which is where the book prints it.
	it("are stated on the improvement, with the clause the book opens them with", () => {
		const clause = (bySlug["township"].system.effects ?? [])
			.find(e => e.text.startsWith("roll 2d6+Population"));
		expect(clause.when).toEqual({
			kind: "completed", phrase: "when **_winter grips the land_**",
		});
	});
});


// A clause waiting on the season's own roll is paid BY that roll (see SteadingSeason#recordRoll), and
// what holds it back from being paid is `condition` — the flag for a clause the sheet cannot judge.
// Neither of these two carries one: the only thing they wait on is the roll, which the sheet knows.
describe("the improvements that wait on the season's own roll", () => {
	it("are the two the book gives a 7+", () => {
		expect(outcomeGated.map(e => `${e.slug} ${e.outcome}`).sort())
			.toEqual(["harnessing-the-stream 7+", "raincatching 7+"]);
	});

	// Marked conditional, they would be stated and left to the table for ever — the roll would land on
	// the row and pay nothing.
	it("state no condition beyond the roll itself", () => {
		expect(outcomeGated.filter(e => e.condition).map(e => e.slug)).toEqual([]);
	});
});
