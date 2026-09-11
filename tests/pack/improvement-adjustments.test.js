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
let procedures;

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
