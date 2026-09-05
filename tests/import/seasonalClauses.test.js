import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { effectRegion, rejectedMentions, seasonalClausesFor } from "../../scripts/import/seasonalClauses.js";

// The pass runs over the REAL pack sources, so it is tested against them: a fixture would let the
// heuristic drift away from the files it actually parses and still pass. The counts below are the
// discrimination itself — if a hand edit to an improvement's prose changes what is lifted, that is
// exactly the thing this file exists to say out loud.

const ROOT = "packs/src/steading-improvements";

function improvements() {
	return ["stonetop", "additional"].flatMap(dir =>
		readdirSync(join(ROOT, dir)).filter(f => f.endsWith(".json")).sort().map(f => {
			const doc = JSON.parse(readFileSync(join(ROOT, dir, f), "utf8"));
			return { slug: f.replace(/\.json$/, ""), dir, list: doc.system?.choices?.list ?? [] };
		}));
}

const bySlug = slug => improvements().find(i => i.slug === slug);
const clausesOf = slug => seasonalClausesFor(bySlug(slug).list).clauses;

describe("the effect region", () => {
	// Requirement rows are the rows with a track — that IS what a track is — so everything after the
	// last of them is what the improvement DOES rather than what it costs.
	it("starts after the last requirement row", () => {
		const region = effectRegion(bySlug("mill").list);
		expect(region).toHaveLength(1);
		expect(region[0]).toMatch(/Henceforth, when the autumn harvest is complete/);
	});

	// well-trained-militia and roadbuilding carry no "Henceforth" / "meet the requirements" marker at
	// all, which is why the last tracked row is the anchor and the marker cannot be.
	it("finds the effects of an improvement with no Henceforth marker", () => {
		expect(effectRegion(bySlug("well-trained-militia").list).join(" ")).toMatch(/Each summer/);
	});

	// A bug in the Book II box parser glues rhoillyg-orchard's whole effect paragraph onto its last
	// requirement row. Taking the tail from the marker recovers it without waiting on that fix.
	it("recovers an effect paragraph glued onto a requirement row", () => {
		expect(effectRegion(bySlug("rhoillyg-orchard").list).join(" "))
			.toMatch(/generates \+1 Surplus in summer/);
	});
});

describe("what carries a seasonal clause", () => {
	it("lifts one from eighteen of the twenty-four improvements", () => {
		const withClauses = improvements()
			.filter(i => seasonalClausesFor(i.list).clauses.length)
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
		const without = improvements().filter(i => !seasonalClausesFor(i.list).clauses.length);
		expect(without.map(i => i.slug).sort()).toEqual([
			"aetherium-crucible", "expanded-trades", "golden-sapling",
			"heroic-reputation", "palisade", "roadbuilding",
		]);
	});
});

describe("what the sweep must NOT lift", () => {
	// "Retrieve an ◇◇ acorn from the boughs of the Golden Oak in late autumn" is a requirement row:
	// it happens once, on the way to building the thing. A keyword sweep takes it; this must not.
	it("rejects a season named inside a requirement row", () => {
		expect(clausesOf("golden-sapling")).toEqual([]);
		expect(rejectedMentions(bySlug("golden-sapling").list).some(r => /late autumn/.test(r.text))).toBe(true);
	});

	// "Large herds form on the Flats in spring" is scene-setting above the requirements. The
	// improvement DOES have a real spring clause lower down, so the file qualifies — but on its
	// effect, not on its flavour.
	it("rejects flavour prose above the requirements", () => {
		expect(clausesOf("aurochs-hunting")).toHaveLength(1);
		expect(clausesOf("aurochs-hunting")[0].text).toMatch(/lead the aurochs hunt in spring/);
	});

	it("rejects 'a full spring' and 'over the course of a summer' as requirement rows", () => {
		const rejected = rejectedMentions(bySlug("rhoillyg-orchard").list).map(r => r.text);
		expect(rejected.some(t => /A full spring/.test(t))).toBe(true);
		expect(clausesOf("rhoillyg-orchard").every(c => !/A full spring/.test(c.text))).toBe(true);
	});

	// "automatically mark the Greater Harvest improvement" names an improvement, not a season.
	it("does not mistake the Greater Harvest improvement's name for a harvest", () => {
		expect(seasonalClausesFor(bySlug("golden-sapling").list).unmatched).toEqual([]);
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
	// and the improvement quietly falls off the checklist. Nothing in the sources may be unmatched.
	it("leaves nothing in the real sources unmatched", () => {
		const noisy = improvements()
			.map(i => ({ slug: i.slug, unmatched: seasonalClausesFor(i.list).unmatched }))
			.filter(i => i.unmatched.length);
		expect(noisy).toEqual([]);
	});

	it("reports a season named through a phrase the table doesn't know", () => {
		const { clauses, unmatched } = seasonalClausesFor([
			{ content: { text: "A requirement" }, track: { max: 1 } },
			{ content: { text: "Henceforth, when the frost of Harvestide comes, and once winter has half-passed, something." } },
		]);
		expect(clauses).toEqual([]);
		expect(unmatched).toHaveLength(1);
	});
});
