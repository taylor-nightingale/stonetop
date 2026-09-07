import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
	SeasonProcedure, SeasonStep, RollStep, ConsumeStep, GenerateStep, PickStep, MomentStep, ResetStep,
} from "../../src/model/data/steading/SeasonProcedure.js";
import { SeasonalPicks } from "../../src/model/data/steading/SeasonalPicks.js";

// The sheet used to hardcode ONE procedure — roll it, pick 1 seasonal gain, reset Fortunes — which
// is Spring's and wrong for the other three. These are what the four moves actually say.

const move = steps => ({ steps });

describe("SeasonStep.from", () => {
	it("builds each kind as its own class", () => {
		expect(SeasonStep.from({ kind: "roll" })).toBeInstanceOf(RollStep);
		expect(SeasonStep.from({ kind: "consume" })).toBeInstanceOf(ConsumeStep);
		expect(SeasonStep.from({ kind: "generate" })).toBeInstanceOf(GenerateStep);
		expect(SeasonStep.from({ kind: "pick" })).toBeInstanceOf(PickStep);
		expect(SeasonStep.from({ kind: "moment" })).toBeInstanceOf(MomentStep);
		expect(SeasonStep.from({ kind: "reset" })).toBeInstanceOf(ResetStep);
	});

	// A step the sheet cannot draw is a step the table would tick with nothing happening.
	it("drops a kind it cannot draw", () => {
		expect(SeasonStep.from({ kind: "sacrifice" })).toBeNull();
		expect(SeasonStep.from(null)).toBeNull();
	});
});

describe("a roll step", () => {
	// The move's OWN roll — the one its 10+/7-9/6- tiers belong to. Rolling it is what turns the
	// wheel, so its control is the move's, not the step's.
	it("knows the move's own tiered roll from a roll of its own dice", () => {
		expect(new RollStep({ stat: "fortunes", tiers: true }).isTieredRoll).toBe(true);
		expect(new RollStep({ die: "1d4", stat: "population" }).isFormulaRoll).toBe(true);
	});

	// Winter's first roll had no control at all: the panel's one button rolled +Fortunes, which is
	// winter's FOURTH step.
	it("carries the dice and the rating a formula roll adds", () => {
		const step = new RollStep({ die: "1d4", stat: "population" });
		expect(step.die).toBe("1d4");
		expect(step.statLabelKey).toBe("stonetop.steading.attr.population");
	});

	it("names no rating when it adds none", () => {
		expect(new RollStep({ stat: "fortunes", tiers: true }).statLabelKey)
			.toBe("stonetop.steading.attr.fortunes");
		expect(new RollStep({ die: "1d4" }).statLabelKey).toBeNull();
	});
});

describe("a pick step", () => {
	// Which list, and the MOST the move offers — summer gives 2 on a 10+ and 1 on a 7-9, and the
	// sheet does not know which was rolled. The move's own text states the condition.
	it("names its list and how many it offers", () => {
		const step = new PickStep({ from: "seasonal-gains", count: 2 });
		expect(step.from).toBe("seasonal-gains");
		expect(step.count).toBe(2);
		expect(step.labelKey).toBe("stonetop.steading.seasons.steps.pick.seasonal-gains");
	});

	it("offers one by default", () => {
		expect(new PickStep({ from: "winter-losses" }).count).toBe(1);
	});
});

// Autumn's move ends "when the harvest is complete, roll 1d4" — the harvest is a step of the move,
// and improvements hook the same moment.
describe("a moment step", () => {
	it("takes its label from the moment it names", () => {
		expect(new MomentStep({ moment: "autumn-harvest" }).labelKey)
			.toBe("stonetop.steading.seasons.moments.autumn-harvest");
	});

	it("states the season's own half only when the season rolls for it", () => {
		expect(new MomentStep({ moment: "autumn-harvest", die: "1d4" }).noteKey).not.toBeNull();
		expect(new MomentStep({ moment: "aurochs-hunt" }).noteKey).toBeNull();
	});
});

describe("SeasonProcedure.from", () => {
	it("reads the steps a move carries, in order", () => {
		const procedure = SeasonProcedure.from(move([
			{ kind: "roll", stat: "fortunes", tiers: true },
			{ kind: "pick", from: "seasonal-gains", count: 1 },
			{ kind: "reset", target: "fortunes" },
		]));
		expect(procedure.steps.map(s => s.kind)).toEqual(["roll", "pick", "reset"]);
	});

	// Order is DATA: winter's +Fortunes roll is its fourth step, behind the consumption and the
	// loss, where the old panel made it the one button at the top.
	it("keeps winter's two rolls in the order winter's move gives them", () => {
		const procedure = SeasonProcedure.from(move([
			{ kind: "roll", die: "1d4", stat: "population" },
			{ kind: "consume" },
			{ kind: "pick", from: "winter-losses", count: 1 },
			{ kind: "roll", stat: "fortunes", tiers: true },
			{ kind: "reset" },
		]));
		expect(procedure.steps[0].isFormulaRoll).toBe(true);
		expect(procedure.steps[3].isTieredRoll).toBe(true);
	});

	// A homebrew Seasons Change, or one from a pack built before procedures existed. It is still a
	// move you roll, and rolling it is what turns the wheel — a steading that could not turn its own
	// season would be worse off than one drawing the wrong steps.
	it("gives a move carrying no steps the one step every seasonal move has", () => {
		for (const empty of [move([]), move(null), move([{ kind: "sacrifice" }])]) {
			const procedure = SeasonProcedure.from(empty);
			expect(procedure.steps).toHaveLength(1);
			expect(procedure.steps[0].isTieredRoll).toBe(true);
		}
	});

	// Nothing else is assumed on its behalf: a gain to pick and a Fortunes reset are things a
	// particular season's move says, and this one does not.
	it("assumes no gain and no reset for a move that says neither", () => {
		expect(SeasonProcedure.from(move([])).pick).toBeNull();
		expect(SeasonProcedure.from(move([])).steps.some(s => s.isReset)).toBe(false);
	});

	// No move at all is different from a move with nothing in it: a steading whose season move the GM
	// deleted has no procedure to draw.
	it("is null where there is no move", () => {
		expect(SeasonProcedure.from(null)).toBeNull();
	});

	it("finds the choice the season hands the table", () => {
		const procedure = SeasonProcedure.from(move([
			{ kind: "roll", stat: "fortunes", tiers: true },
			{ kind: "pick", from: "winter-losses", count: 1 },
		]));
		expect(procedure.pick.from).toBe("winter-losses");
	});

	it("finds no choice in a season that hands none", () => {
		expect(SeasonProcedure.from(move([{ kind: "reset" }])).pick).toBeNull();
	});
});


// A step's label key is chosen at RUNTIME, from its kind and (for a pick) the list it names — so
// localization-keys.test.js, which sweeps the literal keys written in templates, cannot see any of
// them. An unresolved one prints "stonetop.steading.seasons.steps.consume" into the turn control.
describe("every step's label resolves to a real string", () => {
	const en = JSON.parse(readFileSync(path.resolve(process.cwd(), "languages/en.json"), "utf8"));
	const lookup = key => key.split(".").reduce((node, part) => (node ?? {})[part], en);

	const everyStep = [
		new RollStep({ stat: "fortunes", tiers: true }),
		new RollStep({ die: "1d4", stat: "population" }),
		new ConsumeStep(),
		new GenerateStep({ die: "1d4-1" }),
		new MomentStep({ moment: "autumn-harvest", die: "1d4" }),
		new ResetStep({ target: "fortunes" }),
		...SeasonalPicks.GROUPS.map(from => new PickStep({ from })),
	];

	it.each(everyStep)("$kind", step => {
		expect(typeof lookup(step.labelKey), step.labelKey).toBe("string");
		if (step.noteKey) expect(typeof lookup(step.noteKey), step.noteKey).toBe("string");
		if (step.statLabelKey) expect(typeof lookup(step.statLabelKey), step.statLabelKey).toBe("string");
	});
});
