import { describe, it, expect } from "vitest";
import { AdjustedStepRoll, AdjustmentGroup, SeasonAdjustments } from "../../../../src/model/snapshot/steading/SeasonAdjustments.js";
import { SeasonProcedure } from "../../../../src/model/data/steading/SeasonProcedure.js";
import { StepAdjustment } from "../../../../src/model/data/steading/ImprovementEffect.js";
import { readFileSync } from "fs";
import path from "path";

// Four genuinely different hook points used to be one axis, and the sheet drew all four the same:
// Township and Additional Housing change what you ROLL, Stone Wall and the Golden Sapling change what
// you PAY once it is rolled. `at` tells them apart, and `affects` on the move's own steps says which
// step each one lands on.

// The real procedures, read from the pack rather than restated: the whole claim here is that an
// adjustment finds the right step of the season's actual move.
const procedure = season => SeasonProcedure.from(JSON.parse(readFileSync(
	path.resolve(process.cwd(), `packs/src/moves/seasons/seasons-change-${season}.json`), "utf8",
)).system);

const line = (source, raw, { condition = null } = {}) =>
	({ source, condition, adjustment: StepAdjustment.fromRaw(raw) });

const TOWNSHIP = line("Township", { step: "consumption", at: "formula", die: "2d6", stat: "population" });
const HOUSING  = line("Additional Housing", { step: "consumption", at: "term", term: "population", amount: -1 });
const WALL     = line("Stone Wall", { step: "consumption", at: "result", amount: -1 });
const SAPLING  = line("Golden Sapling", { step: "generation", at: "result", amount: 1 });

describe("where an adjustment lands", () => {
	// Winter names `consumption` twice — on the roll and on the consume line after it. What bends the
	// consumption bends the ROLL, which is the step with the control and the step that moves Surplus.
	it("puts what bends winter's consumption on the step that rolls for it", () => {
		const winter = procedure("winter");
		expect(winter.indexFor("consumption")).toBe(0);
		expect(winter.steps[1].kind).toBe("consume");
	});

	it("puts what bends generation on summer's generate step and autumn's harvest", () => {
		expect(procedure("summer").indexFor("generation")).toBe(2);
		expect(procedure("autumn").indexFor("generation")).toBe(3);
	});

	// Spring generates nothing and consumes nothing: there is no step of its own to hang either on.
	it("finds no step in a season that does neither", () => {
		expect(procedure("spring").indexFor("generation")).toBeNull();
		expect(procedure("spring").indexFor("consumption")).toBeNull();
	});
});

describe("SeasonAdjustments — what a step actually rolls", () => {
	const winter = () => procedure("winter");

	// "roll 2d6+Population to consume Surplus, instead of 1d4+Population"
	it("replaces the dice where an improvement replaces them, and names it", () => {
		const roll = new SeasonAdjustments([TOWNSHIP], winter()).rollFor(winter().steps[0], 0);
		expect([roll.die, roll.stat]).toEqual(["2d6", "population"]);
		expect(roll.sources).toEqual(["Township"]);
		expect(roll.isAdjusted).toBe(true);
	});

	// "when consuming Surplus, consider Population to be 1 lower than it is" — the formula is
	// untouched; what changes is what Population counts as inside it.
	it("leaves the formula alone and lowers the term", () => {
		const roll = new SeasonAdjustments([HOUSING], winter()).rollFor(winter().steps[0], 0);
		expect([roll.die, roll.stat]).toEqual(["1d4", "population"]);
		expect(roll.termDelta).toBe(-1);
		// The rating still resolves through resolveBonus, debilities and all; this is applied after.
		expect(roll.bonusFrom(3)).toBe(2);
	});

	// A township with additional housing rolls 2d6 against a Population counted one lower.
	it("takes both at once, and names both", () => {
		const roll = new SeasonAdjustments([TOWNSHIP, HOUSING], winter()).rollFor(winter().steps[0], 0);
		expect([roll.die, roll.termDelta]).toEqual(["2d6", -1]);
		expect(roll.sources).toEqual(["Township", "Additional Housing"]);
	});

	// The step's own dice, unchanged, are still an answer — one shape serves the control either way.
	it("answers with the step's own dice where nothing bends them", () => {
		const roll = new SeasonAdjustments([], winter()).rollFor(winter().steps[0], 0);
		expect([roll.die, roll.stat, roll.termDelta, roll.isAdjusted]).toEqual(["1d4", "population", 0, false]);
	});

	// `rollFor` answers what the DICE hooks make of the step; what the result hooks make of it is
	// folded in afterwards, by the one caller that knows them — see buildSeasonSteps.
	it("keeps a result adjustment out of rollFor, and hands it back as a result", () => {
		const adjustments = new SeasonAdjustments([WALL], winter());
		expect(adjustments.rollFor(winter().steps[0], 0).isAdjusted).toBe(false);
		expect(adjustments.resultsFor(0).map(l => l.source)).toEqual(["Stone Wall"]);
	});

	// One list to read, in the order it bends the step: what changes the dice, then what changes what
	// they cost. Each is a sentence the book already wrote, so the sheet states them rather than
	// summarising them — what it made of them is the dice the control rolls.
	it("reads back as one list, the dice first and then the cost", () => {
		const lines = new SeasonAdjustments([WALL, TOWNSHIP, HOUSING], winter()).linesFor(0);
		expect(lines.map(l => l.source)).toEqual(["Township", "Additional Housing", "Stone Wall"]);
	});

	it("reads back nothing for a step nothing bends", () => {
		expect(new SeasonAdjustments([WALL], winter()).linesFor(2)).toEqual([]);
	});
});

describe("SeasonAdjustments — what no step claimed", () => {
	// The Golden Sapling generates +1 whenever the steading generates at all, and spring generates
	// nothing. Its clause still has to be readable somewhere.
	it("keeps a bend with no step of its own in this season", () => {
		const adjustments = new SeasonAdjustments([SAPLING], procedure("spring"));
		expect(adjustments.unclaimed.map(l => l.source)).toEqual(["Golden Sapling"]);
		expect(adjustments.unclaimedGroups.map(g => g.step)).toEqual(["generation"]);
	});

	it("claims it in a season that does generate", () => {
		const summer = procedure("summer");
		const adjustments = new SeasonAdjustments([SAPLING], summer);
		expect(adjustments.unclaimed).toEqual([]);
		expect(adjustments.resultsFor(2).map(l => l.source)).toEqual(["Golden Sapling"]);
	});

	// Nowhere is a real answer, not a failure: a term adjustment naming a rating the step does not add
	// would change nothing at all, so it is stated rather than swallowed by a control it cannot reach.
	it("keeps a term adjustment the step's roll does not add", () => {
		const winter = procedure("winter");
		const prosperity = line("Homebrew", { step: "consumption", at: "term", term: "prosperity", amount: -1 });
		const adjustments = new SeasonAdjustments([prosperity], winter);
		expect(adjustments.rollFor(winter.steps[0], 0).isAdjusted).toBe(false);
		expect(adjustments.unclaimed.map(l => l.source)).toEqual(["Homebrew"]);
	});

	it("keeps everything where the season has no move at all", () => {
		expect(new SeasonAdjustments([WALL], null).unclaimed.map(l => l.source)).toEqual(["Stone Wall"]);
	});
});

describe("AdjustmentGroup", () => {
	it("gathers them under the step each one bends, in the order the steps are named", () => {
		expect(AdjustmentGroup.groupsFor([WALL, SAPLING, HOUSING])
			.map(g => [g.step, g.lines.map(l => l.source)])).toEqual([
			["consumption", ["Stone Wall", "Additional Housing"]],
			["generation", ["Golden Sapling"]],
		]);
	});

	// A heading over nothing would read as a step this steading does differently when it does not.
	it("makes no group for a step nothing bends", () => {
		expect(AdjustmentGroup.groupsFor([WALL]).map(g => g.step)).toEqual(["consumption"]);
		expect(AdjustmentGroup.groupsFor([])).toEqual([]);
	});

	it("names each group by the step, for a heading", () => {
		expect(AdjustmentGroup.groupsFor([WALL])[0].labelKey)
			.toBe("stonetop.steading.effects.step.consumption");
	});
});

describe("AdjustedStepRoll", () => {
	it("names the rating it adds, and nothing where it adds none", () => {
		expect(new AdjustedStepRoll({ die: "1d4", stat: "population" }).statLabelKey)
			.toBe("stonetop.steading.attr.population");
		expect(new AdjustedStepRoll({ die: "1d4" }).statLabelKey).toBeNull();
	});

	// What decides whether the control names the dice at all: the step's own line has already given
	// the formula, so repeating it under an unbent roll is the sentence twice.
	it("reads as unadjusted until something adjusts it", () => {
		expect(new AdjustedStepRoll({ die: "1d4" }).isAdjusted).toBe(false);
		expect(new AdjustedStepRoll({ die: "1d4", sources: ["Township"] }).isAdjusted).toBe(true);
	});

	// One improvement bending the dice AND what they cost is one source. It decides only whether the
	// control names the formula, and naming it twice would not name it harder.
	it("counts each source once", () => {
		expect(new AdjustedStepRoll({ die: "1d4", sources: ["Mill", "Mill"] }).sources).toEqual(["Mill"]);
	});

	// "consumes 1 less Surplus than normal" — the book takes it off after the roll, and the sheet used
	// to as well. In the dice, the total the table watches IS the Surplus that leaves the stores.
	it("takes a result delta into the bonus, and names what put it there", () => {
		const roll = new AdjustedStepRoll({ die: "2d6", stat: "population", termDelta: -1 })
			.withResultDelta(-1, ["Stone Wall"]);
		expect([roll.termDelta, roll.resultDelta, roll.modifier]).toEqual([-1, -1, -2]);
		expect(roll.bonusFrom(2)).toBe(0);
		expect(roll.sources).toEqual(["Stone Wall"]);
		expect(roll.isAdjusted).toBe(true);
	});

	// A new roll rather than a mutated one, and nothing at all where there is nothing to fold in.
	it("answers with itself where the delta is nothing", () => {
		const roll = new AdjustedStepRoll({ die: "1d4" });
		expect(roll.withResultDelta(0, ["Stone Wall"])).toBe(roll);
	});

	it("carries the result delta through extra dice", () => {
		const roll = new AdjustedStepRoll({ die: "1d4" })
			.withResultDelta(1, ["Golden Sapling"])
			.withExtraDice(["1d4"], ["Greater Harvest"]);
		expect([roll.die, roll.resultDelta]).toEqual(["1d4 + 1d4", 1]);
		expect(roll.sources).toEqual(["Golden Sapling", "Greater Harvest"]);
	});

	// Prose on a button, so a true minus sign — "Roll 2d6 + Population − 2".
	it("prints the modifier for a reader, and nothing where it is nothing", () => {
		expect(new AdjustedStepRoll({ die: "2d6", termDelta: -1 }).withResultDelta(-1).modifierLabel)
			.toBe("\u2212 2");
		expect(new AdjustedStepRoll({ die: "1d4" }).withResultDelta(1).modifierLabel).toBe("+ 1");
		expect(new AdjustedStepRoll({ die: "1d4" }).modifierLabel).toBeNull();
	});

	// And ASCII for Foundry, which has to parse it. "1d4 + -1" evaluates, and reads like a bug.
	it("writes an expression Foundry can parse, negatives and all", () => {
		const wall = new AdjustedStepRoll({ die: "1d4", stat: "population" }).withResultDelta(-1);
		expect(wall.expressionFrom(0)).toBe("1d4 - 1");
		expect(wall.expressionFrom(1)).toBe("1d4 + 0");
		expect(wall.expressionFrom(3)).toBe("1d4 + 2");
	});
});
