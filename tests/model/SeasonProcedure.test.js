import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
	SeasonProcedure, SeasonStep, RollStep, ConsumeStep, GenerateStep, PickStep, MomentStep, ResetStep,
} from "../../src/model/data/steading/SeasonProcedure.js";
import { MoveResults } from "../../src/model/data/MoveResults.js";
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
		expect(new RollStep({ die: "1d4", stat: "population" }).rollsDice).toBe(true);
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

// The move's own 10+/7-9/6-, as rows the roll lands on. The three were one sentence on the step
// until a tier had something to DO — winter's 7-9 consumes another 1d4+Population — which was prose
// in the middle of a clause with no control, no record and no way to undo it.
describe("a tiered roll's results", () => {
	const WINTER = MoveResults.fromRaw({
		success: { label: "10+", value: "The winter is relatively mild." },
		partial: { label: "7-9", value: "Consume additional Surplus equal to 1d4+Population." },
		failure: { label: "6-",  value: "As a 7-9, but also threats abound." },
	});

	const winterRoll = (results = null) =>
		new RollStep({ stat: "fortunes", tiers: true, results }, WINTER);

	// The words are the move's own results — never authored on the step — so the box and the chat
	// card cannot say different things and there is one thing to translate.
	it("takes its words and its label from the move's own results", () => {
		const results = winterRoll().results;
		expect(results.map(r => r.key)).toEqual(["success", "partial", "failure"]);
		expect(results[1].label).toBe("7-9");
		expect(results[1].text.raw).toBe("Consume additional Surplus equal to 1d4+Population.");
	});

	// What the STEP adds is only what the sheet can act on: which tier, which dice, which way they
	// move Surplus.
	it("hangs the step's mechanics on the tier they belong to", () => {
		const results = winterRoll({
			partial: { die: "1d4", stat: "population", affects: "consumption" },
			failure: { die: "1d4", stat: "population", affects: "consumption" },
		}).results;
		expect(results.map(r => r.rollsDice)).toEqual([false, true, true]);
		expect(results[1].die).toBe("1d4");
		expect(results[1].stat).toBe("population");
		expect(results[1].affects).toBe("consumption");
		expect(results[1].statLabelKey).toBe("stonetop.steading.attr.population");
	});

	// A button that rolls and then changes nothing is worse than words alone: `#applySurplusRoll`
	// moves Surplus by which SIDE of the season the roll names, and a roll naming neither moves none.
	it("leaves a tier as words when its mechanics name nothing the sheet can move", () => {
		const results = winterRoll({
			success: { affects: "consumption" },
			partial: { die: "1d4" },
			failure: { die: "1d4", affects: "somewhere" },
		}).results;
		expect(results.some(r => r.rollsDice)).toBe(false);
	});

	// A row the reader never sees cannot offer a roll.
	it("drops mechanics for a tier the move does not have", () => {
		const results = new RollStep({ stat: "fortunes", tiers: true, results: {
			partial: { die: "1d4", affects: "consumption" },
		} }, MoveResults.fromRaw({ success: { label: "10+", value: "Mild." } })).results;
		expect(results.map(r => r.key)).toEqual(["success"]);
	});

	// Every other step is something the season does whatever was rolled, so results on one would be
	// three rows under a line that does not answer them.
	it("belongs to the move's own roll and to nothing else", () => {
		expect(new RollStep({ die: "1d4", stat: "population",
			results: { partial: { die: "1d4", affects: "consumption" } } }, WINTER).results).toEqual([]);
		expect(new RollStep({ stat: "fortunes", tiers: true }).hasResults).toBe(false);
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
		expect(procedure.steps[0].rollsDice).toBe(true);
		expect(procedure.steps[3].isTieredRoll).toBe(true);
	});

	// The move's results reach the step that rolls for them, off the move itself — the box draws the
	// results the card prints rather than a second copy authored on the step.
	it("hands the move's own results to the roll they belong to", () => {
		const procedure = SeasonProcedure.from({
			steps: [{ kind: "roll", stat: "fortunes", tiers: true }, { kind: "reset" }],
			moveResults: {
				success: { label: "10+", value: "Mild." },
				partial: { label: "7-9", value: "Consume another 1d4+Population." },
				failure: { label: "6-",  value: "Threats abound." },
			},
		});
		expect(procedure.steps[0].results.map(r => r.label)).toEqual(["10+", "7-9", "6-"]);
	});

	// A move carrying none — every move in the system but these four — draws no rows at all rather
	// than three blank ones.
	it("leaves the roll of a move with no results carrying none", () => {
		expect(SeasonProcedure.from(move([{ kind: "roll", stat: "fortunes", tiers: true }]))
			.steps[0].results).toEqual([]);
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

// The step carries the move's own words. "Roll it" and "Roll 1d4" drop the trigger ("when winter
// grips the land"), the roller ("whoever is the weariest") and winter's Meet with Disaster clause —
// the whole reason the numbered list read as a stub of the move rather than as the move.
describe("a step's text", () => {
	it("carries the move's own words as rich text", () => {
		const step = SeasonStep.from({ kind: "roll", die: "1d4", stat: "population",
			text: "When **_winter grips the land_**, whoever is weariest rolls 1d4+Population." });
		expect(step.text.raw).toContain("whoever is weariest");
		expect(step.text.render()).toContain("<em>");
	});

	it.each(["roll", "consume", "generate", "pick", "moment", "reset"])(
		"is carried by a %s step", kind => {
			expect(SeasonStep.from({ kind, text: "words" }).text.raw).toBe("words");
		});

	// A homebrew Seasons Change carries no authored text, and falls back to the label key.
	it.each(["roll", "consume", "generate", "pick", "moment", "reset"])(
		"is null on a %s step with none, so the label key is used instead", kind => {
			const step = SeasonStep.from({ kind });
			expect(step.text).toBeNull();
			expect(step.labelKey).toBeTruthy();
		});
});

// A step that names dice the sheet can roll. Winter's opening 1d4+Population is the obvious one, but
// summer's "generates 1d4-1 Surplus" and autumn's "roll 1d4" at the harvest name dice too, and had no
// control — which only became obvious once each step said so in the book's own words.
describe("a step that names its own dice", () => {
	it("offers a roll for every kind that carries a die", () => {
		expect(new RollStep({ die: "1d4", stat: "population" }).rollsDice).toBe(true);
		expect(new GenerateStep({ die: "1d4-1" }).rollsDice).toBe(true);
		expect(new MomentStep({ moment: "autumn-harvest", die: "1d4" }).rollsDice).toBe(true);
	});

	// The move's OWN roll is the turn control's, and a step with no die has nothing to roll.
	it("offers none for the move's tiered roll, or where there is no die", () => {
		expect(new RollStep({ stat: "fortunes", tiers: true }).rollsDice).toBe(false);
		expect(new GenerateStep({}).rollsDice).toBe(false);
		expect(new MomentStep({ moment: "aurochs-hunt" }).rollsDice).toBe(false);
		expect(new ConsumeStep({}).rollsDice).toBeUndefined();
	});
});

/**
 * "In winter, the village consumes 1d4 + Population Surplus. If Stonetop has shrunk to a hamlet, it
 * consumes only 1d2 + Population. If it has grown to a town, it consumes 2d6 + Population."
 *
 * The dice follow the SIZE. They used to follow the Township improvement, which says the same thing
 * on its own page — so a steading that shrank to a hamlet had nothing saying so.
 */
describe("a step whose dice depend on the steading's size", () => {
	const winter = () => new RollStep({
		die: "1d4", dieBySize: { hamlet: "1d2", village: "1d4", town: "2d6" }, stat: "population",
	});

	it("rolls what the book gives that size", () => {
		expect(winter().dieFor("hamlet")).toBe("1d2");
		expect(winter().dieFor("village")).toBe("1d4");
		expect(winter().dieFor("town")).toBe("2d6");
	});

	// The book stops at town because Stonetop does. A steading that grew past it should not quietly
	// consume less than it did as a town, so an unlisted size takes the nearest smaller tier's dice.
	it("takes the nearest smaller tier's dice for a size the book does not list", () => {
		expect(winter().dieFor("city")).toBe("2d6");
	});

	it("falls back to its own dice for a step with no table, or a size it cannot place", () => {
		expect(new RollStep({ die: "1d4" }).dieFor("town")).toBe("1d4");
		expect(winter().dieFor(null)).toBe("1d4");
		expect(winter().dieFor("metropolis")).toBe("1d4");
	});

	// Read off the pack, not a copy: the table is the winter move's, and a fixture written out here
	// would go on asserting the old one.
	it("is what winter's own move authors", () => {
		const raw = JSON.parse(readFileSync(
			path.resolve(process.cwd(), "packs/src/moves/seasons/seasons-change-winter.json"), "utf8"));
		const step = SeasonProcedure.from(raw.system).steps[0];
		expect([step.dieFor("hamlet"), step.dieFor("village"), step.dieFor("town")])
			.toEqual(["1d2", "1d4", "2d6"]);
	});
});

/**
 * Spring and winter generate nothing of their own, but a steading can still generate in them —
 * Township's Population+1, the market's Surplus, trade with Barrier Pass. Those used to sit in a list
 * beside the season with an Apply per line, which is the one payout on the tab that was not a step
 * of it.
 */
describe("somewhere to pay what the steading generates", () => {
	const spring = () => SeasonProcedure.from(move([
		{ kind: "roll", stat: "fortunes", tiers: true, text: "When spring bursts forth…" },
		{ kind: "pick", from: "seasonal-gains", count: 1 },
		{ kind: "reset", target: "fortunes", text: "Whatever the result, reset Fortunes to +1." },
	]));

	it("adds a generation step to a season that has none", () => {
		const steps = spring().withGenerationStep().steps;
		expect(steps.map(s => s.kind)).toEqual(["roll", "pick", "generate", "reset"]);
	});

	// Before the closing reset, because that is where summer's own move puts it: the season
	// generates, and then Fortunes are reset whatever happened.
	it("puts it where the move that has one puts it", () => {
		const summer = SeasonProcedure.from(move([
			{ kind: "roll", stat: "fortunes", tiers: true },
			{ kind: "generate", die: "1d4-1", affects: "generation" },
			{ kind: "reset", target: "fortunes" },
		]));
		expect(summer.withGenerationStep()).toBe(summer);
		expect(summer.generation.die).toBe("1d4-1");
	});

	it("gives the added step the generating side of the season, and no dice", () => {
		const added = spring().withGenerationStep().generation;
		expect(added.affects).toBe("generation");
		expect(added.rollsDice).toBe(false);
		// Its own words, since the move has none for a step it does not make.
		expect(added.labelKey).toBe("stonetop.steading.seasons.steps.generateGains");
	});

	// What bends the season's generation finds it — the Golden Sapling's "+1 whenever the steading
	// generates, even just 1" in a spring that finally generates something.
	it("is where a bend on the season's generation lands", () => {
		expect(spring().indexFor("generation")).toBeNull();
		expect(spring().withGenerationStep().indexFor("generation")).toBe(2);
	});

	it("appends where a season ends without a reset at all", () => {
		const bare = SeasonProcedure.from(move([{ kind: "roll", stat: "fortunes", tiers: true }]));
		expect(bare.withGenerationStep().steps.map(s => s.kind)).toEqual(["roll", "generate"]);
	});
});
