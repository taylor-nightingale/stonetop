import { describe, it, expect } from "vitest";
import { StepContribution } from "../../../../src/model/snapshot/steading/StepContribution.js";
import { TurnoverLine } from "../../../../src/model/snapshot/steading/TurnoverStatement.js";
import { ImprovementEffect } from "../../../../src/model/data/steading/ImprovementEffect.js";
import { SeasonProcedure } from "../../../../src/model/data/steading/SeasonProcedure.js";

/**
 * Autumn's fourth step IS the harvest, and the mill's +1 is part of that harvest rather than a
 * second event under it. This is what the step takes up into its own roll, and what it can only
 * state.
 */
const line = (source, raw) => new TurnoverLine({
	id: `${source}:0`, source, effect: ImprovementEffect.fromRaw(raw),
});

const MILL    = line("Mill", { when: { kind: "moment", moment: "autumn-harvest" },
	change: { target: "surplus", amount: 1 }, text: "the steading generates +1 Surplus" });
const GREATER = line("Greater Harvest", { when: { kind: "moment", moment: "autumn-harvest" },
	change: { target: "surplus", formula: "1d4" }, text: "gain +1d4 Surplus" });
const IFFY    = line("Somewhere", { when: { kind: "moment", moment: "autumn-harvest" },
	change: { target: "surplus", amount: 1 }, condition: true, text: "another +1 Surplus" });
const FICTION = line("Somewhere", { when: { kind: "moment", moment: "autumn-harvest" },
	text: "the folk talk of it all winter" });

const harvestStep = () => SeasonProcedure.from({ steps: [
	{ kind: "moment", moment: "autumn-harvest", die: "1d4", affects: "generation",
	  text: "When **_the harvest is complete_**, roll 1d4." },
] }).steps[0];

const moment = (lines) => ({ key: "autumn-harvest", labelKey: "harvest", statement: { lines } });

describe("StepContribution", () => {
	it("is nothing for a step that is not a moment", () => {
		const roll = SeasonProcedure.from({ steps: [{ kind: "roll", die: "1d4", stat: "population" }] }).steps[0];
		expect(StepContribution.forMoment(roll, [moment([MILL])])).toBeNull();
	});

	// The gathering at the inn, or a hunt in a spring whose move does not number it: not this step's.
	it("is nothing where nothing fires at the step's own moment", () => {
		expect(StepContribution.forMoment(harvestStep(), [])).toBeNull();
		expect(StepContribution.forMoment(harvestStep(), [{ key: "inn-gathering" }])).toBeNull();
	});

	describe("what the roll takes up", () => {
		const contribution = () => StepContribution.forMoment(harvestStep(), [moment([MILL, GREATER])]);

		it("adds an amount to what the step pays", () => {
			expect(contribution().delta).toBe(1);
		});

		it("adds a rolled clause to the step's own dice", () => {
			expect(contribution().dice).toEqual(["1d4"]);
		});

		it("names the improvements the roll now owes something to", () => {
			expect(contribution().sources).toEqual(["Mill", "Greater Harvest"]);
		});
	});

	/**
	 * A condition the sheet cannot evaluate is stated and never applied — the standing rule everywhere
	 * else on this sheet — and a clause with no amount at all has nothing for the dice to take.
	 */
	it("states what the roll cannot take, and adds none of it", () => {
		const contribution = StepContribution.forMoment(harvestStep(), [moment([MILL, IFFY, FICTION])]);
		expect(contribution.taken.map(l => l.source)).toEqual(["Mill"]);
		expect(contribution.stated.map(l => l.text.raw))
			.toEqual(["another +1 Surplus", "the folk talk of it all winter"]);
		expect(contribution.delta).toBe(1);
	});

	// Every clause is READ under the step, whichever half it is in: what the steading brings to the
	// harvest is one list, and which half a clause is in shows in the dice rather than in a heading.
	it("reads every clause under the step", () => {
		const contribution = StepContribution.forMoment(harvestStep(), [moment([MILL, FICTION])]);
		expect(contribution.lines.map(l => l.source)).toEqual(["Mill", "Somewhere"]);
		expect(contribution.hasLines).toBe(true);
	});

	/**
	 * A moment on the CONSUMING side would need this to decide whether "+1 Surplus" means one more
	 * consumed or one less. Nothing in the book asks for that guess, so it is stated rather than
	 * answered.
	 */
	it("takes nothing up on the consuming side of a season", () => {
		const consuming = SeasonProcedure.from({ steps: [
			{ kind: "moment", moment: "autumn-harvest", die: "1d4", affects: "consumption" },
		] }).steps[0];
		const contribution = StepContribution.forMoment(consuming, [moment([MILL])]);
		expect(contribution.taken).toEqual([]);
		expect(contribution.delta).toBe(0);
		expect(contribution.stated).toHaveLength(1);
	});

	// A move is rolled, and what it does depends on the roll — it renders as that move's own row.
	it("leaves a granted move to the row that draws it", () => {
		const hunt = line("Aurochs Hunting", { when: { kind: "moment", moment: "autumn-harvest" },
			grantsMove: "lead-the-aurochs-hunt", text: "roll +Defenses" });
		expect(StepContribution.forMoment(harvestStep(), [moment([hunt])]).lines).toEqual([]);
	});
});

/**
 * The season's own gains — what the steading generates when the wheel turns. The move already
 * numbers a step for what the SEASON generates, and what the steading generates is that same act.
 */
describe("what the season's generation takes up", () => {
	const generateStep = (die = null) => SeasonProcedure.from({ steps: [
		{ kind: "generate", die, affects: "generation", text: "the steading generates 1d4-1 Surplus" },
	] }).steps[0];

	const TOWN = line("Township", { when: { kind: "turn", seasons: ["spring"] },
		change: { target: "surplus", amount: 3 }, text: "Surplus equal to Population+1" });
	const MARKET = line("Market", { when: { kind: "turn", seasons: ["spring"] },
		change: { target: "surplus", amount: 1 }, condition: true,
		text: "the market generates 1 Surplus" });

	it("is nothing where the step does not generate", () => {
		const roll = SeasonProcedure.from({ steps: [{ kind: "roll", die: "1d4", stat: "population" }] }).steps[0];
		expect(StepContribution.forGains(roll, [TOWN])).toBeNull();
	});

	it("is nothing where the steading generates nothing", () => {
		expect(StepContribution.forGains(generateStep("1d4-1"), [])).toBeNull();
	});

	it("adds what the steading generates to what the step pays", () => {
		const contribution = StepContribution.forGains(generateStep("1d4-1"), [TOWN, MARKET]);
		expect(contribution.delta).toBe(3);
		expect(contribution.sources).toEqual(["Township"]);
		// The market's is stated and never counted: the sheet cannot know whether it was active.
		expect(contribution.stated.map(l => l.source)).toEqual(["Market"]);
		expect(contribution.lines).toHaveLength(2);
	});

	// No moment behind it, so nothing is claimed and no panel disappears.
	it("claims no moment", () => {
		expect(StepContribution.forGains(generateStep(), [TOWN]).momentKey).toBeNull();
	});
});
