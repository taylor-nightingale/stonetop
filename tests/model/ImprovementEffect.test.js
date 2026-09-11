import { describe, it, expect } from "vitest";
import { ImprovementEffects, ImprovementEffect } from "../../src/model/data/steading/ImprovementEffect.js";
import { RequirementBoxes } from "../../src/model/data/steading/ImprovementRequirement.js";
import { Season } from "../../src/model/data/steading/Seasons.js";

const boxes = (sizes, counts = {}) => new RequirementBoxes(sizes, counts);
const effect = raw => ImprovementEffect.fromRaw(raw);

// The Mill, as the book states it: the requirements buy a rating and a Resources entry once, and the
// mill then generates Surplus at every autumn harvest thereafter.
const MILL = ImprovementEffects.fromRaw([
	{ requires: { all: ["site", "miller"] }, when: { kind: "completed" },
	  change: { target: "fortunes", amount: 1 }, text: "increase Fortunes by 1" },
	{ requires: { all: ["site", "miller"] }, when: { kind: "completed" },
	  listEntry: { list: "resources", text: "Mill" }, text: 'add "Mill" to the Resources list' },
	{ requires: { all: ["site", "miller"] }, when: { kind: "moment", moment: "autumn-harvest" },
	  change: { target: "surplus", amount: 1 }, text: "the steading generates +1 Surplus" },
]);
const MILL_SIZES = { site: 1, miller: 2 };

describe("what the sheet may apply, and what it only states", () => {
	it("applies a plain rating delta", () => {
		expect(effect({ change: { target: "surplus", amount: 1 }, text: "t" }).isAutomatic).toBe(true);
	});

	it("applies a list entry", () => {
		expect(effect({ listEntry: { list: "resources", text: "Mill" }, text: "t" }).isAutomatic).toBe(true);
	});

	// A die is the table's to roll.
	it("only states an effect the book rolls for", () => {
		expect(effect({ change: { target: "surplus", formula: "1d4" }, text: "t" }).isAdvisory).toBe(true);
	});

	// "if the market is active, and Population is +1 or better" — the sheet cannot know. The WORDS
	// are the trigger's clause; this is only the flag saying the sheet cannot judge them.
	it("only states an effect carrying a condition it cannot evaluate", () => {
		expect(effect({
			change: { target: "surplus", amount: 1 }, condition: true, text: "t",
		}).isAdvisory).toBe(true);
		expect(effect({
			change: { target: "surplus", amount: 1 }, condition: true, text: "t",
		}).isConditional).toBe(true);
	});

	// An improvement embedded on a steading before the flag replaced the duplicated words still
	// stores the sentence. A non-empty one means exactly what the flag now means, so it is read
	// as the flag rather than migrated — and an absent or empty one is no condition at all.
	it("reads a stored condition sentence as the flag it became", () => {
		expect(effect({ change: { target: "surplus", amount: 1 },
			condition: "the market is active", text: "t" }).isConditional).toBe(true);
		expect(effect({ change: { target: "surplus", amount: 1 },
			condition: "", text: "t" }).isConditional).toBe(false);
		expect(effect({ change: { target: "surplus", amount: 1 }, text: "t" }).isConditional).toBe(false);
	});

	// An adjustment bends an arithmetic the sheet never performs.
	it("only states an adjustment", () => {
		expect(effect({
			adjustment: { step: "consumption", amount: -1 }, text: "consumes 1 less Surplus than normal",
		}).isAdvisory).toBe(true);
	});

	it("only states pure fiction", () => {
		expect(effect({ text: "a threat to the steading makes itself known" }).isAdvisory).toBe(true);
	});

	// The book's sentence is never derived from the numbers; it says things no amount can.
	it("keeps the book's own words beside the arithmetic", () => {
		const e = effect({ change: { target: "surplus", amount: -1 }, text: "the watch consumes 1 Surplus or it disbands" });
		expect(e.text).toBe("the watch consumes 1 Surplus or it disbands");
		expect(e.change.amount).toBe(-1);
	});
});

describe("a result only fires once its requirement holds", () => {
	// The mill generates nothing each autumn until there is a mill.
	it("withholds a seasonal result from an unbuilt improvement", () => {
		const unbuilt = boxes(MILL_SIZES, { site: 1 });
		expect(MILL.firingAt("moment", unbuilt, { moment: "autumn-harvest" })).toEqual([]);
	});

	it("fires it once the requirement is met", () => {
		const built = boxes(MILL_SIZES, { site: 1, miller: 2 });
		const firing = MILL.firingAt("moment", built, { moment: "autumn-harvest" });
		expect(firing.map(e => e.text)).toEqual(["the steading generates +1 Surplus"]);
	});

	it("keeps the harvest out of the turn", () => {
		const built = boxes(MILL_SIZES, { site: 1, miller: 2 });
		expect(MILL.firingAt("turn", built, { season: new Season("autumn") })).toEqual([]);
	});

	it("gives completion its two results, and only at completion", () => {
		const built = boxes(MILL_SIZES, { site: 1, miller: 2 });
		expect(MILL.firingAt("completed", built).map(e => e.text)).toEqual([
			"increase Fortunes by 1", 'add "Mill" to the Resources list',
		]);
	});
});

describe("seasons on a turn trigger", () => {
	const watch = ImprovementEffects.fromRaw([
		{ requires: "leaders", when: { kind: "turn" },
		  change: { target: "surplus", amount: -1 }, text: "the watch consumes 1 Surplus or it disbands" },
	]);
	const herd = ImprovementEffects.fromRaw([
		{ requires: "herd", when: { kind: "turn", seasons: ["winter"] },
		  change: { target: "surplus", amount: -1 }, text: "the herd consumes 1 Surplus per 6 horses" },
	]);

	// Naming no season means every season — "at the start of each season".
	it("fires in every season when none is named", () => {
		const b = boxes({ leaders: 1 }, { leaders: 1 });
		for (const key of ["spring", "summer", "autumn", "winter"]) {
			expect(watch.firingAt("turn", b, { season: new Season(key) })).toHaveLength(1);
		}
	});

	it("fires only in the season it names", () => {
		const b = boxes({ herd: 1 }, { herd: 1 });
		expect(herd.firingAt("turn", b, { season: new Season("winter") })).toHaveLength(1);
		expect(herd.firingAt("turn", b, { season: new Season("summer") })).toHaveLength(0);
	});
});

describe("a lapse is a requirement going false, not a trigger", () => {
	// Expanded Trades: "increase Prosperity by 1. If you cease to meet the requirements, decrease
	// Prosperity by 1." The reversal needs no trigger of its own — the same result simply stops
	// holding when the arbiter leaves.
	const trades = ImprovementEffects.fromRaw([
		{ requires: { all: [{ any: 1, of: ["stream", "mill"] }, { any: 3, of: ["a", "b", "c", "d"] }] },
		  when: { kind: "completed" }, change: { target: "prosperity", amount: 1 },
		  text: "increase Prosperity by 1" },
	]);
	const sizes = { stream: 1, mill: 1, a: 1, b: 1, c: 1, d: 1 };

	it("holds while the requirement is met", () => {
		expect(trades.firingAt("completed", boxes(sizes, { mill: 1, a: 1, b: 1, c: 1 }))).toHaveLength(1);
	});

	it("stops holding when it is not", () => {
		expect(trades.firingAt("completed", boxes(sizes, { mill: 1, a: 1, b: 1 }))).toHaveLength(0);
	});
});

describe("whether the improvement is built", () => {
	it("is false while nothing it promises is true", () => {
		expect(MILL.isBuilt(boxes(MILL_SIZES, { site: 1 }))).toBe(false);
	});

	it("is true once its requirements are met", () => {
		expect(MILL.isBuilt(boxes(MILL_SIZES, { site: 1, miller: 2 }))).toBe(true);
	});

	// Well-Trained Militia: the militia EXISTS as soon as there is a veteran warrior to command it —
	// its summer upkeep says so by requiring only that — even though its "+1 Defenses" waits on two
	// trained tactics. Demanding every result would leave it unbuilt while the table trained one.
	it("is true when any one result holds, not only when all of them do", () => {
		const militia = ImprovementEffects.fromRaw([
			{ requires: "veteran-warrior", when: { kind: "turn", seasons: ["summer"] },
			  change: { target: "surplus", amount: -1 },
			  text: "the militia must spend 1 Surplus practicing or else lose its training in 1 tactic" },
			{ requires: { all: ["veteran-warrior", { any: 2, of: ["archery", "cavalry", "formations"] }] },
			  when: { kind: "completed" }, change: { target: "defenses", amount: 1 },
			  text: "increase Defenses by 1" },
		]);
		const sizes = { "veteran-warrior": 1, archery: 1, cavalry: 1, formations: 1 };

		expect(militia.isBuilt(boxes(sizes, { "veteran-warrior": 1 }))).toBe(true);
		expect(militia.firingAt("completed", boxes(sizes, { "veteran-warrior": 1 }))).toHaveLength(0);
		expect(militia.firingAt("completed", boxes(sizes, { "veteran-warrior": 1, archery: 1, cavalry: 1 })))
			.toHaveLength(1);
	});

	it("is false for an improvement with no results authored", () => {
		expect(ImprovementEffects.fromRaw([]).isBuilt(boxes({}))).toBe(false);
		expect(ImprovementEffects.fromRaw(undefined).isEmpty).toBe(true);
	});
});

// Four genuinely different hook points used to be one axis, and the sheet drew all four the same.
// `at` says WHERE in a step a bend lands: the dice it rolls, a term inside them, or what it pays.
describe("where an adjustment hooks", () => {
	const adjustment = raw => effect({ adjustment: raw, text: "t" }).adjustment;

	it("reads the authored hook", () => {
		expect(adjustment({ step: "consumption", at: "formula", die: "2d6", stat: "population" }).isFormula).toBe(true);
		expect(adjustment({ step: "consumption", at: "term", term: "population", amount: -1 }).isTerm).toBe(true);
		expect(adjustment({ step: "consumption", at: "result", amount: -1 }).isResult).toBe(true);
	});

	// The dice and the rating rather than a formula string — the exact pair rollSeasonStep takes, so
	// the rating still resolves through resolveBonus and there is no `@` path to parse.
	it("carries the dice and the rating a formula adjustment replaces them with", () => {
		const a = adjustment({ step: "consumption", at: "formula", die: "2d6", stat: "population" });
		expect([a.die, a.stat]).toEqual(["2d6", "population"]);
	});

	// Read off the payload where it is not stated: a homebrew improvement written against the older
	// shape still lands somewhere true rather than silently becoming a reduction.
	it("reads an unstated hook off what the adjustment carries", () => {
		expect(adjustment({ step: "consumption", die: "2d6" }).at).toBe("formula");
		expect(adjustment({ step: "consumption", term: "population", amount: -1 }).at).toBe("term");
		expect(adjustment({ step: "consumption", amount: -1 }).at).toBe("result");
		expect(adjustment({ step: "consumption", at: "weather", amount: -1 }).at).toBe("result");
	});

	// Still never applied: it bends an arithmetic that has not happened.
	it("is stated, whichever hook it uses", () => {
		expect(effect({ adjustment: { step: "consumption", at: "formula", die: "2d6" }, text: "t" }).isAdvisory)
			.toBe(true);
	});
});

// Two kinds of result the season's own box shows somewhere of its own, rather than in the general
// list: what waits on the move's own roll, and what the steading pays to keep what it built.
describe("results the season's steps show for themselves", () => {
	it("knows a result that waits on the season's own roll", () => {
		const e = effect({ when: { kind: "turn", seasons: ["spring"] },
			change: { target: "surplus", amount: 1 }, outcome: "7+",
			condition: true, text: "the steading generates 1 Surplus" });
		expect(e.isOutcomeGated).toBe(true);
		// The notation stays the book's; what the sheet takes from it is which rows of the move's own
		// results the clause belongs under — a 7+ being the 10+ row and the 7-9 row both.
		expect(e.outcome.label).toBe("7+");
		expect(e.firesOnTier("success")).toBe(true);
		expect(e.firesOnTier("partial")).toBe(true);
		expect(e.firesOnTier("failure")).toBe(false);
	});

	// A bill for something built, not a step of the move and not a payout.
	it("knows the steading's own upkeep from what a season pays out", () => {
		const bill = effect({ when: { kind: "turn" }, change: { target: "surplus", amount: -1 },
			text: "the watch consumes 1 Surplus, or it disbands" });
		const payout = effect({ when: { kind: "turn", seasons: ["autumn"] },
			change: { target: "surplus", amount: 1 }, text: "the mill generates +1 Surplus" });
		const completion = effect({ change: { target: "surplus", amount: -1 }, text: "spend 1 Surplus" });
		expect([bill.isUpkeep, payout.isUpkeep, completion.isUpkeep]).toEqual([true, false, false]);
	});

	// It is still plain arithmetic the sheet can write — moving it to its own section did not make it
	// advisory, and the season's Apply still pays it.
	it("keeps the upkeep applicable", () => {
		expect(effect({ when: { kind: "turn" }, change: { target: "surplus", amount: -1 }, text: "t" })
			.isAutomatic).toBe(true);
	});

	// An outcome the sheet cannot see is not arithmetic it can do.
	it("never applies what waits on a roll", () => {
		expect(effect({ when: { kind: "turn" }, change: { target: "surplus", amount: 1 },
			outcome: "7+", text: "t" }).isAutomatic).toBe(false);
	});
});

// Township's completion: two ratings asserted rather than moved, and the one payload that can touch
// Size at all.
describe("a rating set rather than moved", () => {
	it("reads a tier word onto Size", () => {
		const e = effect({ set: { target: "size", value: "town" }, text: "change Size to town" });
		expect(e.set.target).toBe("size");
		expect(e.set.value).toBe("town");
		expect(e.set.isNumeric).toBe(false);
	});

	it("reads a number onto a quantity, zero included", () => {
		const e = effect({ set: { target: "population", value: 0 }, text: "change Population to +0" });
		expect(e.set.value).toBe(0);
		expect(e.set.isNumeric).toBe(true);
	});

	// A set is unambiguous arithmetic — "to +0" leaves nothing for a human to judge — so the sheet
	// offers to do it, which is the whole point of modelling it instead of leaving it as a sentence.
	it("is arithmetic the sheet can apply", () => {
		expect(effect({ set: { target: "size", value: "town" }, text: "t" }).isAutomatic).toBe(true);
	});

	it("is left to the table once it carries a condition", () => {
		expect(effect({ set: { target: "size", value: "town" }, condition: true, text: "t" })
			.isAutomatic).toBe(false);
	});

	// Validated against the RATING's own values, so a mistyped tier fails here rather than writing a
	// Size the select cannot show.
	it("refuses a tier the rating does not name", () => {
		expect(effect({ set: { target: "size", value: "metropolis" }, text: "t" }).set).toBeNull();
	});

	it("refuses a tier word on a quantity, and a number on Size", () => {
		expect(effect({ set: { target: "population", value: "town" }, text: "t" }).set).toBeNull();
		expect(effect({ set: { target: "size", value: 2 }, text: "t" }).set).toBeNull();
	});

	it("refuses a rating it does not know", () => {
		expect(effect({ set: { target: "morale", value: 1 }, text: "t" }).set).toBeNull();
	});

	// Size is settable and never addable: "+1 Size" is not a sentence the book writes.
	it("keeps Size out of a delta", () => {
		expect(effect({ change: { target: "size", amount: 1 }, text: "t" }).change).toBeNull();
	});
});

// Modelled so the sheet can REMIND the table, and for nothing else — the roll mode stays theirs.
describe("advantage an improvement entitles the steading to", () => {
	it("reads the moves it names", () => {
		const e = effect({ advantage: { moves: ["muster", "pull-together", "trade-barter"] },
			text: "you have advantage to Muster, Pull Together and Trade & Barter" });
		expect(e.advantage.moves).toEqual(["muster", "pull-together", "trade-barter"]);
	});

	// There is nothing to write: advantage is a reminder, and applying it would mean the sheet had
	// decided what mode the table rolls in.
	it("is never something the sheet applies", () => {
		expect(effect({ advantage: { moves: ["muster"] }, text: "t" }).isAutomatic).toBe(false);
	});

	it("ignores an advantage that names no move", () => {
		expect(effect({ advantage: { moves: [] }, text: "t" }).advantage).toBeNull();
		expect(effect({ advantage: {}, text: "t" }).advantage).toBeNull();
		expect(effect({ advantage: { moves: ["", "  "] }, text: "t" }).advantage).toBeNull();
	});
});

describe("reading the authored form", () => {
	it("drops a result with no text — a bare payload says nothing to the table", () => {
		expect(ImprovementEffects.fromRaw([{ change: { target: "surplus", amount: 1 } }]).isEmpty).toBe(true);
	});

	it("ignores a target, list or step it does not know", () => {
		const e = effect({
			change: { target: "morale", amount: 1 },
			listEntry: { list: "pantry", text: "x" },
			adjustment: { step: "weather", amount: 1 },
			text: "t",
		});
		expect([e.change, e.listEntry, e.adjustment]).toEqual([null, null, null]);
	});

	it("defaults an unknown trigger kind to completion", () => {
		expect(effect({ when: { kind: "eclipse" }, text: "t" }).trigger.kind).toBe("completed");
	});
});

/**
 * "the town generates Surplus equal to Population+1" — authored as a formula because that is what it
 * is, and read as a die for as long as the sheet could not tell the two apart. There are no dice in
 * it: it is arithmetic over a rating the sheet already knows.
 */
describe("arithmetic over the steading's own ratings", () => {
	const change = formula => effect({ change: { target: "surplus", formula }, text: "t" }).change;

	it("works out a sum of ratings and whole numbers", () => {
		expect(change("@population + 1").amountFrom({ population: 2 })).toBe(3);
		expect(change("@population - 1").amountFrom({ population: 2 })).toBe(1);
		expect(change("2").amountFrom({})).toBe(2);
	});

	it("leaves the dice to the table", () => {
		expect(change("1d4").hasDice).toBe(true);
		expect(change("1d4").amountFrom({})).toBeNull();
		expect(change("1d4 + @population").amountFrom({ population: 2 })).toBeNull();
	});

	// Not an expression parser: anything the book does not write is stated and left to the table.
	it("refuses an expression it cannot read, and a rating it does not have", () => {
		expect(change("2 * @population").amountFrom({ population: 2 })).toBeNull();
		expect(change("@population + 1").amountFrom({})).toBeNull();
	});

	// The arithmetic is done where the ratings are known, and the result is an ordinary delta —
	// which is what gives Township's spring Surplus the same Apply every other payout has.
	it("resolves into a plain result the sheet can write", () => {
		const town = effect({
			when: { kind: "turn", seasons: ["spring"] },
			change: { target: "surplus", formula: "@population + 1" },
			text: "the town generates Surplus equal to Population+1",
		});
		expect(town.isAutomatic).toBe(false);

		const here = town.resolvedFor({ population: 2 });
		expect(here.change.amount).toBe(3);
		expect(here.isAutomatic).toBe(true);
		expect(here.text).toBe(town.text);
	});

	it("leaves a result with nothing to work out exactly as it was", () => {
		const mill = effect({ change: { target: "surplus", amount: 1 }, text: "t" });
		expect(mill.resolvedFor({ population: 2 })).toBe(mill);
		expect(effect({ text: "fiction" }).resolvedFor({})).toBeInstanceOf(ImprovementEffect);
	});
});

/**
 * "if you roll a 7+ with Fortunes" is not a condition the sheet cannot evaluate. It is a fact about
 * a roll, printed inside the result rows it covers, and the reader answers it by pressing the button
 * on the row the dice landed on.
 */
describe("a result the roll's own row can write", () => {
	const raincatching = effect({
		when: { kind: "turn", seasons: ["summer"] }, change: { target: "surplus", amount: 1 },
		condition: true, outcome: "7+", text: "the steading generates 1 Surplus",
	});

	it("knows a plain payout waiting on the roll", () => {
		expect(raincatching.isOutcomeArithmetic).toBe(true);
		// Still never written by the season's own batch, which cannot know what was rolled.
		expect(raincatching.isAutomatic).toBe(false);
	});

	it("is nothing of the kind where there is nothing to write", () => {
		expect(effect({
			when: { kind: "turn" }, outcome: "7+", condition: true, text: "threats abound",
		}).isOutcomeArithmetic).toBe(false);
		expect(effect({
			when: { kind: "turn" }, outcome: "7+", condition: true,
			change: { target: "surplus", formula: "1d4" }, text: "gain 1d4 Surplus",
		}).isOutcomeArithmetic).toBe(false);
	});

	// A condition with no outcome is still the sheet's to state and never to write.
	it("leaves an ordinary condition where it was", () => {
		expect(effect({
			when: { kind: "turn" }, change: { target: "surplus", amount: 1 },
			condition: true, text: "the market generates 1 Surplus",
		}).isOutcomeArithmetic).toBe(false);
	});
});
