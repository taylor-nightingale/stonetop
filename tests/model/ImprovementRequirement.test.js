import { describe, it, expect } from "vitest";
import {
	AllOf, AnyOf, RequirementBoxes, RequirementRow, parseRequirement,
} from "../../src/model/data/steading/ImprovementRequirement.js";

// Rows as the pack states them: a slug, and how many boxes the book prints in front of it.
const rows = (...specs) => specs.map(([slug, max]) => ({ slug, track: { max } }));

const boxes = (specs, ticked = {}) => RequirementBoxes.from(rows(...specs), ticked);

describe("a requirement row", () => {
	it("is met only when its track is full", () => {
		const req = parseRequirement("pull-together");
		expect(req.isMet(boxes([["pull-together", 5]], { "pull-together": 4 }))).toBe(false);
		expect(req.isMet(boxes([["pull-together", 5]], { "pull-together": 5 }))).toBe(true);
	});

	it("counts its boxes, and never more than it has", () => {
		const b = boxes([["a", 2]], { a: 9 });
		expect(parseRequirement("a").tickedIn(b)).toBe(2);
		expect(parseRequirement("a").neededIn(b)).toBe(2);
	});
});

describe("all of", () => {
	const b = t => boxes([["a", 1], ["b", 2], ["c", 1]], t);

	it("needs every term", () => {
		const req = parseRequirement({ all: ["a", "b", "c"] });
		expect(req.isMet(b({ a: 1, b: 2 }))).toBe(false);
		expect(req.isMet(b({ a: 1, b: 2, c: 1 }))).toBe(true);
	});

	it("sums the boxes of everything it names", () => {
		const req = parseRequirement({ all: ["a", "b", "c"] });
		expect(req.neededIn(b({}))).toBe(4);
		expect(req.tickedIn(b({ a: 1, b: 1 }))).toBe(2);
	});

	// A result with nothing to require simply holds — the improvement existing is enough.
	it("is met when it names nothing", () => {
		expect(parseRequirement({ all: [] }).isMet(b({}))).toBe(true);
		expect(parseRequirement(undefined).isMet(b({}))).toBe(true);
	});
});

describe("any N of", () => {
	// Greater Harvest: the live bug. Two ways to get there, one of them needed.
	const harvest = t => boxes([["double-yield", 1], ["clear-fields", 1]], t);
	const req = parseRequirement({ any: 1, of: ["double-yield", "clear-fields"] });

	it("is met by one of two — the case that could never complete before", () => {
		expect(req.isMet(harvest({}))).toBe(false);
		expect(req.isMet(harvest({ "double-yield": 1 }))).toBe(true);
		expect(req.isMet(harvest({ "clear-fields": 1 }))).toBe(true);
	});

	// The denominator is what the book asks for, not how many ways it offers.
	it("needs one box, not two", () => {
		expect(req.neededIn(harvest({}))).toBe(1);
		expect(req.tickedIn(harvest({ "double-yield": 1 }))).toBe(1);
	});

	// Nothing stops a table ticking both; the meter must not then read 2 of 1.
	it("caps progress at what was needed", () => {
		expect(req.tickedIn(harvest({ "double-yield": 1, "clear-fields": 1 }))).toBe(1);
	});

	it("counts to a threshold above one", () => {
		const three = parseRequirement({ any: 3, of: ["a", "b", "c", "d", "e", "f"] });
		const b = t => boxes([["a", 1], ["b", 1], ["c", 1], ["d", 1], ["e", 1], ["f", 1]], t);
		expect(three.isMet(b({ a: 1, b: 1 }))).toBe(false);
		expect(three.isMet(b({ a: 1, b: 1, f: 1 }))).toBe(true);
		expect(three.neededIn(b({}))).toBe(3);
	});

	// "1 of the following" and "either one of these" both mean one.
	it("means one when no number is given", () => {
		expect(parseRequirement({ of: ["a", "b"] }).count).toBe(1);
	});

	// A count larger than the list is the book saying "all of them" in another voice.
	it("never asks for more terms than it lists", () => {
		expect(parseRequirement({ any: 9, of: ["a", "b"] }).count).toBe(2);
	});
});

describe("nesting — Weapons of War", () => {
	// "Requires either this: [a few dozen swords] Or all of these: [a smith, iron ore, four seasons
	// of work]. And then: [a veteran warrior, Pulling Together]." Either you buy the weapons or you
	// build the means to make them.
	const req = parseRequirement({ all: [
		{ any: 1, of: ["swords", { all: ["smith", "iron-ore", "four-seasons"] }] },
		"veteran-warrior",
		"pull-together",
	] });

	const b = t => boxes([
		["swords", 1], ["smith", 1], ["iron-ore", 1], ["four-seasons", 4],
		["veteran-warrior", 1], ["pull-together", 1],
	], t);

	const trailing = { "veteran-warrior": 1, "pull-together": 1 };

	it("is met by buying the weapons", () => {
		expect(req.isMet(b({ swords: 1, ...trailing }))).toBe(true);
	});

	it("is met by making them instead", () => {
		expect(req.isMet(b({ smith: 1, "iron-ore": 1, "four-seasons": 4, ...trailing }))).toBe(true);
	});

	it("is not met by half of the making branch", () => {
		expect(req.isMet(b({ smith: 1, "iron-ore": 1, ...trailing }))).toBe(false);
	});

	it("still needs what follows the branch, whichever branch was taken", () => {
		expect(req.isMet(b({ swords: 1 }))).toBe(false);
	});

	// The cheap branch is one box; the meter should not demand the expensive one.
	it("measures against the cheaper branch", () => {
		expect(req.neededIn(b({}))).toBe(3);   // swords + warrior + pull-together
	});
});

describe("thresholds over an improvement's own rows — Well-Trained Militia", () => {
	// The tactics are not requirements to build the militia; they are what it accumulates, and one
	// of its results keys off how many. "+1 Defenses" needs the warrior AND two or more tactics.
	const TACTICS = ["archery", "cavalry", "formations", "readiness", "skirmishing"];
	const b = t => boxes([["veteran-warrior", 1], ...TACTICS.map(s => [s, 1])], t);

	const upkeep   = parseRequirement({ all: ["veteran-warrior"] });
	const defenses = parseRequirement({ all: ["veteran-warrior", { any: 2, of: TACTICS }] });

	it("holds the upkeep as soon as the militia exists", () => {
		expect(upkeep.isMet(b({ "veteran-warrior": 1 }))).toBe(true);
	});

	it("withholds the Defenses bump until two tactics are trained", () => {
		expect(defenses.isMet(b({ "veteran-warrior": 1 }))).toBe(false);
		expect(defenses.isMet(b({ "veteran-warrior": 1, archery: 1 }))).toBe(false);
		expect(defenses.isMet(b({ "veteran-warrior": 1, archery: 1, cavalry: 1 }))).toBe(true);
	});

	// Two results of one improvement, two different requirements — which is the whole reason
	// completion is not modelled as a thing of its own.
	it("lets one improvement's results hold at different times", () => {
		const state = b({ "veteran-warrior": 1, archery: 1 });
		expect([upkeep.isMet(state), defenses.isMet(state)]).toEqual([true, false]);
	});
});

describe("the rows an expression names", () => {
	it("lists them flat, however deeply nested", () => {
		const req = parseRequirement({ all: [{ any: 1, of: ["a", { all: ["b", "c"] }] }, "d"] });
		expect(req.rows).toEqual(["a", "b", "c", "d"]);
	});
});

describe("RequirementBoxes.from", () => {
	it("reads sizes off the choice rows and counts off the stored values", () => {
		const b = RequirementBoxes.from(
			[{ slug: "a", track: { max: 3 } }, { content: { text: "prose" } }, { slug: "b", track: { max: 1 } }],
			{ a: 2 },
		);
		expect([b.sizeOf("a"), b.countOf("a"), b.isFull("a")]).toEqual([3, 2, false]);
		expect([b.sizeOf("b"), b.countOf("b")]).toEqual([1, 0]);
	});

	// A slug the improvement does not have is not silently "already satisfied".
	it("treats an unknown row as one empty box", () => {
		const b = RequirementBoxes.from([], {});
		expect([b.sizeOf("ghost"), b.isFull("ghost")]).toEqual([1, false]);
	});
});

describe("the classes are usable directly", () => {
	it("composes without the parser", () => {
		const req = new AllOf([new RequirementRow("a"), new AnyOf(1, [new RequirementRow("b")])]);
		expect(req.isMet(boxes([["a", 1], ["b", 1]], { a: 1, b: 1 }))).toBe(true);
	});
});
