import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { seasonalClausesIn } from "../../scripts/import/seasonalClauses.js";

// The sweep runs over the REAL sources, so it is tested against them: a fixture would let the
// heuristic drift away from the prose it actually parses and still pass. The counts below are the
// discrimination itself — if a hand edit to an improvement's payoff changes what is lifted, that is
// exactly the thing this file exists to say out loud.
//
// The prose comes from each improvement's `_prose` rather than from its rows. It used to be in both:
// the row copy was stripped because it was a second statement of everything `system.effects` says and
// BOTH were extracted for translation.

const ROOT = "packs/src/steading-improvements";

function improvements() {
	return ["stonetop", "additional"].flatMap(dir =>
		readdirSync(join(ROOT, dir)).filter(f => f.endsWith(".json")).sort().map(f => {
			const doc = JSON.parse(readFileSync(join(ROOT, dir, f), "utf8"));
			return { slug: doc.system.slug, dir, prose: doc._prose ?? [] };
		}));
}

const bySlug    = slug => improvements().find(i => i.slug === slug);
const clausesOf = slug => seasonalClausesIn(bySlug(slug).prose).clauses;

describe("what carries a seasonal clause", () => {
	it("lifts one from eighteen of the twenty-four improvements", () => {
		const withClauses = improvements()
			.filter(i => seasonalClausesIn(i.prose).clauses.length)
			.map(i => i.slug);
		expect(withClauses.sort()).toEqual([
			"additional-housing", "aurochs-hunting", "great-wood-timber", "greater-harvest",
			"harnessing-the-stream", "herd-of-horses", "inn", "market", "mill",
			"permanent-logging-camp", "raincatching", "rhoillyg-orchard", "standing-watch",
			"stone-wall", "township", "trade-with-barrier-pass", "weapons-of-war",
			"well-trained-militia",
		]);
	});

	// The six that carry none must stay out: an improvement on the checklist that does nothing this
	// season is worse than one missing, because it gets ticked and believed.
	it("leaves the six that carry none alone", () => {
		const without = improvements().filter(i => !seasonalClausesIn(i.prose).clauses.length);
		expect(without.map(i => i.slug).sort()).toEqual([
			"aetherium-crucible", "expanded-trades", "golden-sapling",
			"heroic-reputation", "palisade", "roadbuilding",
		]);
	});

	// "Retrieve an ◇◇ acorn from the boughs of the Golden Oak in late autumn" is a REQUIREMENT — it
	// happens once, on the way to building the thing. It never reaches the sweep now, because the
	// prose the sweep reads is the payoff and nothing else; this asserts that separation holds in the
	// data rather than trusting it.
	it("never sees a season named in a requirement row", () => {
		expect(clausesOf("golden-sapling")).toEqual([]);
		expect(bySlug("golden-sapling").prose.join(" ")).not.toMatch(/late autumn/);
		expect(bySlug("rhoillyg-orchard").prose.join(" ")).not.toMatch(/A full spring/);
	});

	// "Large herds form on the Flats in spring" is scene-setting above the requirements. The
	// improvement DOES have a real spring clause — on its payoff, not on its flavour.
	it("lifts the aurochs hunt's spring clause and not its flavour", () => {
		expect(clausesOf("aurochs-hunting")).toHaveLength(1);
		expect(clausesOf("aurochs-hunting")[0].text).toMatch(/lead the aurochs hunt in spring/);
	});

	// "automatically mark the Greater Harvest improvement" names an improvement, not a harvest.
	it("does not mistake the Greater Harvest improvement's name for a harvest", () => {
		expect(seasonalClausesIn(bySlug("golden-sapling").prose).unmatched).toEqual([]);
	});
});

describe("which seasons a clause names", () => {
	it("reads a single season off the book's own phrase", () => {
		expect(clausesOf("mill")).toEqual([expect.objectContaining({ seasons: ["autumn"] })]);
		expect(clausesOf("stone-wall")).toEqual([expect.objectContaining({ seasons: ["winter"] })]);
		expect(clausesOf("weapons-of-war")).toEqual([expect.objectContaining({ seasons: ["spring"] })]);
	});

	it("reads the list out of 'the Seasons Change to spring, summer, or autumn'", () => {
		expect(clausesOf("market")[0].seasons).toEqual(["spring", "summer", "autumn"]);
	});

	// "when the seasons change" and "at the start of each season" are every season, and must not be
	// confused with the "…change TO x" form that names a few.
	it("reads an every-season trigger as all four", () => {
		expect(clausesOf("standing-watch")[0].seasons).toEqual(["spring", "summer", "autumn", "winter"]);
		expect(clausesOf("inn")[0].seasons).toEqual(["spring", "summer", "autumn", "winter"]);
	});

	// The Herd of Horses breeds in summer and eats in winter — two clauses, two seasons, one item.
	it("keeps two clauses of one improvement apart", () => {
		expect(clausesOf("herd-of-horses").map(c => c.seasons)).toEqual([["summer"], ["winter"]]);
	});

	it("keeps township's growth and its winter cost apart", () => {
		expect(clausesOf("township").map(c => c.seasons)).toEqual([["spring", "summer"], ["winter"]]);
	});

	// One SENTENCE naming two seasons — stopping at the first trigger lost the autumn half.
	it("unions both seasons of a clause that names two", () => {
		expect(clausesOf("rhoillyg-orchard")[0].seasons).toEqual(["summer", "autumn"]);
	});
});

describe("unrecognised phrasing", () => {
	// The loud failure the trigger table exists for: a season named some new way produces no clause,
	// and the improvement quietly falls off the checklist. Nothing in the real prose may be unmatched.
	it("leaves nothing in the real sources unmatched", () => {
		const noisy = improvements()
			.map(i => ({ slug: i.slug, unmatched: seasonalClausesIn(i.prose).unmatched }))
			.filter(i => i.unmatched.length);
		expect(noisy).toEqual([]);
	});

	it("reports a season named through a phrase the table doesn't know", () => {
		const { clauses, unmatched } = seasonalClausesIn([
			"Henceforth, when the frost of Harvestide comes, and once winter has half-passed, something.",
		]);
		expect(clauses).toEqual([]);
		expect(unmatched).toHaveLength(1);
	});
});
