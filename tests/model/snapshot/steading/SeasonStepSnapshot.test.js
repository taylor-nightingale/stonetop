import { describe, it, expect } from "vitest";
import { buildSeasonSteps, SeasonStepSnapshot } from "../../../../src/model/snapshot/steading/SeasonStepSnapshot.js";
import { AdjustedStepRoll } from "../../../../src/model/snapshot/steading/SeasonAdjustments.js";
import { SeasonProcedure } from "../../../../src/model/data/steading/SeasonProcedure.js";
import { StepAdjustment } from "../../../../src/model/data/steading/ImprovementEffect.js";
import { AppliedStepRoll } from "../../../../src/model/data/steading/AppliedStepRoll.js";
import { readFileSync } from "fs";
import path from "path";

// One step with everything this steading brings to it. The partial used to reach back up to the root
// for two of these — the applied record by index, the pick group off the snapshot — which is the
// shape of an object that was missing.

const procedure = season => SeasonProcedure.from(JSON.parse(readFileSync(
	path.resolve(process.cwd(), `packs/src/moves/seasons/seasons-change-${season}.json`), "utf8",
)).system);

const line = (source, raw, { isConditional = false } = {}) =>
	({ source, isConditional, adjustment: StepAdjustment.fromRaw(raw) });

const WALL    = line("Stone Wall", { step: "consumption", at: "result", amount: -1 });
const TIMBER  = line("Great Wood Timber", { step: "consumption", at: "result", amount: -1 });
const CAMP    = line("Permanent Logging Camp", { step: "consumption", at: "result", amount: -1 },
	{ isConditional: true });
const SAPLING = line("Golden Sapling", { step: "generation", at: "result", amount: 1 });
// A clause waiting on the move's own roll rather than bending a step — "7+", which covers two rows.
const STREAM  = { source: "Harnessing the Stream", firesOnTier: k => ["success", "partial"].includes(k) };

const step = (results = []) => new SeasonStepSnapshot({ step: procedure("winter").steps[0], index: 0, results });

describe("what a step actually pays", () => {
	// The signs already agree: −1 is one less consumed, +1 is one more generated.
	it("takes what the improvements reduce it by", () => {
		expect(step([WALL]).resultDelta).toBe(-1);
		expect(step([WALL, TIMBER]).resultDelta).toBe(-2);
		expect(step([SAPLING]).resultDelta).toBe(1);
		expect(step().resultDelta).toBe(0);
	});

	// A clause the sheet cannot evaluate is stated and never applied — the system's standing rule,
	// and the reason the logging camp's reduction is not folded into what the control writes.
	it("leaves out a reduction the table has to judge", () => {
		expect(step([CAMP]).resultDelta).toBe(0);
		expect(step([WALL, CAMP]).resultDelta).toBe(-1);
	});

	// A step with no dice of its own has nowhere to put the delta, so its whole amount is this.
	it("moves the total by it where no roll carried it, and never below nothing at all", () => {
		expect(step([WALL]).amountFor(6)).toBe(5);
		expect(step([SAPLING]).amountFor(0)).toBe(1);
		expect(step([WALL]).amountFor(0)).toBe(0);
	});

	// A step that ROLLS has it in its bonus already — taking it off the total again is paying it twice.
	it("leaves the total alone where the dice already carried it", () => {
		const rolling = new SeasonStepSnapshot({
			step: procedure("winter").steps[0], index: 0, results: [WALL],
			roll: new AdjustedStepRoll({ die: "1d4", stat: "population" }).withResultDelta(-1, ["Stone Wall"]),
		});
		expect(rolling.resultDelta).toBe(-1);
		expect(rolling.unrolledDelta).toBe(0);
		expect(rolling.amountFor(6)).toBe(6);
	});
});

describe("buildSeasonSteps", () => {
	const winter = () => buildSeasonSteps({
		procedure: procedure("winter"),
		statement: { adjustments: [WALL], outcomeGated: [STREAM] },
		applied:   { 0: new AppliedStepRoll({ total: 6, due: 5, from: 5, to: 0 }) },
		pick:      { group: { slug: "winter-losses" } },
	});

	it("numbers the steps from one, in the move's own order", () => {
		expect(winter().steps.map(s => s.number)).toEqual([1, 2, 3, 4, 5]);
	});

	// Winter's opening roll: its dice, what bends what it pays, and what it already did.
	it("gives a rolling step its dice, what bends it and its record", () => {
		const first = winter().at(0);
		expect([first.die, first.stat]).toEqual(["1d4", "population"]);
		expect(first.adjustments.map(l => l.source)).toEqual(["Stone Wall"]);
		expect(first.hasAdjustments).toBe(true);
		expect(first.applied.amount).toBe(5);
	});

	// Two lists, because they answer two questions: what the reader is SHOWN, and what the roll does
	// with them. A bend that changes the dice is read under the step but changes nothing it pays.
	it("counts only the bends that change what it pays", () => {
		const withBoth = buildSeasonSteps({
			procedure: procedure("winter"),
			statement: { adjustments: [
				WALL,
				{ source: "Township", isConditional: false,
				  adjustment: StepAdjustment.fromRaw({ step: "consumption", at: "formula", die: "2d6" }) },
			] },
		}).at(0);
		expect(withBoth.adjustments).toHaveLength(2);
		expect(withBoth.resultDelta).toBe(-1);
	});

	// The whole of it in one formula: "2d6 + Population − 2" for a town that counts Population 1
	// lower and pays 1 less. Two hooks, two sentences under the step, one number on the dice.
	it("folds what a step pays into the dice it rolls", () => {
		const winterStep = buildSeasonSteps({
			procedure: procedure("winter"), size: "town",
			statement: { adjustments: [
				WALL,
				{ source: "Additional Housing", isConditional: false,
				  adjustment: StepAdjustment.fromRaw({ step: "consumption", at: "term", term: "population", amount: -1 }) },
			] },
		}).at(0);
		expect(winterStep.die).toBe("2d6");
		expect(winterStep.roll.bonusFrom(2)).toBe(0);
		expect(winterStep.roll.expressionFrom(2)).toBe("2d6 + 0");
		expect(winterStep.modifierLabel).toBe("\u2212 2");
		// Rolled 7 with Population 2, so 7 Surplus leaves — the total on the dice, not a number
		// arrived at afterwards.
		expect(winterStep.amountFor(7)).toBe(7);
	});

	// A clause the sheet cannot judge stays out of the dice as it stays out of everything else.
	it("keeps a reduction the table has to judge off the dice", () => {
		const winterStep = buildSeasonSteps({
			procedure: procedure("winter"), statement: { adjustments: [CAMP] },
		}).at(0);
		expect(winterStep.roll.modifier).toBe(0);
		expect(winterStep.modifierLabel).toBeNull();
	});

	// Stone Wall alone leaves the dice the book's and only bends what they come to — but that is still
	// not the roll the line above describes, so the control has to say so.
	it("names the formula once a result adjustment has bent it", () => {
		const winterStep = buildSeasonSteps({
			procedure: procedure("winter"), statement: { adjustments: [WALL] },
		}).at(0);
		expect(winterStep.roll.isAdjusted).toBe(true);
		expect(winterStep.roll.sources).toEqual(["Stone Wall"]);
	});

	// A step that rolls nothing offers no dice: the consume line states what the roll above it did.
	it("gives a step that rolls nothing no roll at all", () => {
		const consume = winter().at(1);
		expect(consume.roll).toBeNull();
		expect(consume.rollsDice).toBe(false);
	});

	// The move's own roll is the one that makes it, and a clause waits on a RESULT of it — "7+", which
	// is the 10+ row and the 7-9 row both. Under the row rather than beside the step: the row is the
	// condition, and a clause floating above all three said which roll it meant and not which result.
	it("hangs what waits on the roll inside every result its range covers", () => {
		const tiered = winter().at(3);
		expect(tiered.tiers.filter(t => t.hasOutcomes).map(t => t.key)).toEqual(["success", "partial"]);
		expect(tiered.tiers[0].outcomes).toEqual([STREAM]);
	});

	/**
	 * Winter's dice are the steading's Size's — 1d2 in a hamlet, 1d4 in a village, 2d6 in a town — and
	 * the step's own line is the book's, which says 1d4. So the size is said under the step as well as
	 * rolled by it.
	 */
	describe("the dice the steading's size calls for", () => {
		const inA = size => buildSeasonSteps({ procedure: procedure("winter"), size }).at(0);

		it("rolls the size's own dice", () => {
			expect(inA("town").die).toBe("2d6");
			expect(inA("hamlet").die).toBe("1d2");
		});

		it("says which size made them", () => {
			expect(inA("town").sizeRoll.die).toBe("2d6");
			expect(inA("town").sizeRoll.sizeLabelKey).toBe("stonetop.steading.tier.size.town");
			expect(inA("town").hasSizeRoll).toBe(true);
		});

		// A village rolls what the move's own line already names; saying it again says nothing.
		it("says nothing where the size changes nothing", () => {
			expect(inA("village").die).toBe("1d4");
			expect(inA("village").hasSizeRoll).toBe(false);
			expect(inA(null).hasSizeRoll).toBe(false);
		});

		// Additional Housing counts Population 1 lower INSIDE whatever dice the size calls for.
		it("keeps what the improvements do to the roll on top of it", () => {
			const step = buildSeasonSteps({
				procedure: procedure("winter"), size: "town",
				statement: { adjustments: [
					{ source: "Additional Housing", isConditional: false,
					  adjustment: StepAdjustment.fromRaw({ step: "consumption", at: "term", term: "population", amount: -1 }) },
				] },
			}).at(0);
			expect(step.die).toBe("2d6");
			expect(step.roll.termDelta).toBe(-1);
		});
	});

	// Only the pick step: the group is what the table ticks, and the step is what calls for it.
	it("hands the choice to the step that calls for it", () => {
		expect(winter().steps.filter(s => s.pick).map(s => s.number)).toEqual([3]);
	});

	// A steading whose season move the GM deleted has no procedure, which is not an empty one.
	it("builds nothing where there is no move", () => {
		expect(buildSeasonSteps({}).isEmpty).toBe(true);
		expect(buildSeasonSteps({}).at(0)).toBeNull();
	});
});

// Winter's 7-9 and 6- each consume a SECOND 1d4+Population. It was prose in the middle of the step's
// line — no control, no record, no undo — beside an opening consumption that had all three.
describe("the result rows of the season's own roll", () => {
	const winter = (applied = {}) =>
		buildSeasonSteps({ procedure: procedure("winter"), applied }).at(3);

	it("belong to the tiered roll and to no other step", () => {
		const steps = buildSeasonSteps({ procedure: procedure("winter") }).steps;
		expect(steps.filter(s => s.hasTiers).map(s => s.number)).toEqual([4]);
		expect(winter().tiers.map(t => t.label)).toEqual(["10+", "7-9", "6-"]);
	});

	// Its own dice, not the step's: the step above rolls 2d6+Fortunes, which posts a card and spends
	// no Surplus at all.
	it("give a tier that costs a roll its own dice, and the rest none", () => {
		expect(winter().tiers.map(t => t.rollsDice)).toEqual([false, true, true]);
		const partial = winter().tierFor("partial");
		expect([partial.die, partial.stat]).toEqual(["1d4", "population"]);
		expect(partial.affects).toBe("consumption");
		expect(winter().tierFor("success").roll).toBeNull();
	});

	// Its own record too, so rolling the 7-9 does not read as having rolled winter's opening
	// consumption, and either can be given back on its own.
	it("keep a record of their own, addressed apart from the step's", () => {
		const rolled = winter({ "3:partial": new AppliedStepRoll({ total: 4, from: 6, to: 2 }) });
		expect(rolled.tierFor("partial").applied.amount).toBe(4);
		expect(rolled.tierFor("failure").applied).toBeNull();
		expect(buildSeasonSteps({ procedure: procedure("winter"),
			applied: { 0: new AppliedStepRoll({ total: 4, from: 6, to: 2 }) } })
			.at(3).tierFor("partial").applied).toBeNull();
	});

	// The address is what the control carries and what the store is keyed by, produced in one place.
	it("address themselves by step and tier", () => {
		expect(winter().tierFor("failure").address.key).toBe("3:failure");
		expect(winter().address.key).toBe("3");
	});

	// One entry point for both: the roll handler is handed an address and never asks which of the two
	// it resolved to.
	it("are reached by the same address the step is", () => {
		const steps = buildSeasonSteps({ procedure: procedure("winter") });
		expect(steps.at("3:partial")).toBe(steps.at(3).tierFor("partial"));
		expect(steps.at("3:mild")).toBeNull();
		expect(steps.at("9:partial")).toBeNull();
	});

	// Consumption floors at 0 — "if there's not enough, reduce Surplus to 0 and Meet with Disaster",
	// and the Disaster is the table's, not the sheet's.
	it("move Surplus by what the dice said, and never below nothing at all", () => {
		expect(winter().tierFor("partial").amountFor(5)).toBe(5);
		expect(winter().tierFor("partial").amountFor(-1)).toBe(0);
	});

	// Spring, summer and autumn cost nothing on any result: a control there would offer to spend
	// Surplus the move never asks for.
	it.each(["spring", "summer", "autumn"])("give %s's results no controls", season => {
		const tiered = buildSeasonSteps({ procedure: procedure(season) }).steps.find(s => s.hasTiers);
		expect(tiered.tiers).toHaveLength(3);
		expect(tiered.tiers.some(t => t.rollsDice)).toBe(false);
	});
});
