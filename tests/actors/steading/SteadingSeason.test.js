import { describe, it, expect } from "vitest";
import { SteadingSeason } from "../../../src/actors/steading/SteadingSeason.js";
import { SteadingEffects } from "../../../src/actors/steading/SteadingEffects.js";
import { SteadingImprovements } from "../../../src/actors/steading/SteadingImprovements.js";
import { SteadingImprovement } from "../../../src/actors/steading/repositories/FoundrySteadingImprovementRepository.js";
import { SteadingChoices } from "../../../src/actors/steading/SteadingChoices.js";
import { FakeSteadingImprovementRepository } from "../../fakes/FakeSteadingImprovementRepository.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { SEASONAL_GAINS_GROUP } from "../../../src/model/data/steading/SeasonalPicks.js";

// Improvements as the pack holds them after the model merge: one requirement row, a requirement
// naming it, and results that fire once it is ticked.
function repoWith(...specs) {
	const repo = new FakeSteadingImprovementRepository();
	for (const { slug, name, effects } of specs) {
		repo._improvements.push(new SteadingImprovement(
			slug, name,
			{ slug, list: [{ type: "entry", slug: "built", content: { text: "the work" }, track: { max: 1 } }] },
			repo._improvements.length,
			{ requires: { all: ["built"] }, effects },
		));
	}
	return repo;
}

/** The stored ticks that make every fixture improvement built. */
const BUILT = specs => Object.fromEntries(specs.map(s => [s.slug, { built: 1 }]));

function build({
	owned = [], season, year, improvements = [], impressions, choiceValues,
	unbuilt = false, applied, attributes,
} = {}) {
	const system = {
		improvements: owned,
		improvementValues: unbuilt ? {} : BUILT(improvements),
		attributes: { fortunes: 0, surplus: 0, population: 0, prosperity: 0, defenses: 0, ...attributes },
		assets: { resources: [], fortifications: [], items: [] },
	};
	if (season !== undefined) system.season = season;
	if (year !== undefined) system.year = year;
	if (impressions !== undefined) system.impressions = impressions;
	if (choiceValues !== undefined) system.choiceValues = choiceValues;
	if (applied !== undefined) system.turnoverApplied = applied;

	const actor = new FakeActorBuilder().withSystem(system).build();
	const choices = new SteadingChoices(actor);
	const effects = new SteadingEffects(actor, new SteadingImprovements(actor, repoWith(...improvements)));
	return { actor, choices, effects, season: new SteadingSeason(actor, effects, choices) };
}

const MILL = { slug: "mill", name: "Mill", effects: [
	{ when: { kind: "turn", seasons: ["autumn"] }, change: { target: "surplus", amount: 1 },
	  text: "the steading generates +1 Surplus" },
] };
const WATCH = { slug: "standing-watch", name: "Standing Watch", effects: [
	{ when: { kind: "turn" }, change: { target: "surplus", amount: -1 },
	  text: "the watch consumes 1 Surplus" },
] };
const HERD = { slug: "herd-of-horses", name: "Herd of Horses", effects: [
	{ when: { kind: "turn", seasons: ["summer"] }, text: "the herd gains foals" },
	{ when: { kind: "turn", seasons: ["winter"] }, text: "the herd consumes 1 Surplus" },
] };
const PALISADE = { slug: "palisade", name: "Palisade", effects: [] };
const RAINCATCHING = { slug: "raincatching", name: "Raincatching", effects: [
	{ when: { kind: "turn", seasons: ["summer"] }, change: { target: "surplus", amount: 1 },
	  outcome: "7+", text: "the steading generates 1 Surplus" },
] };
const ORCHARD = { slug: "rhoillyg-orchard", name: "Rhoillyg Orchard", effects: [
	{ when: { kind: "moment", moment: "autumn-harvest" }, change: { target: "surplus", amount: 1 },
	  text: "the orchard yields +1 Surplus" },
] };
const AUROCHS = { slug: "aurochs-hunting", name: "Aurochs Hunting", effects: [
	{ when: { kind: "moment", moment: "aurochs-hunt" }, grantsMove: "lead-the-aurochs-hunt",
	  text: "when you lead the aurochs hunt in spring, roll +Defenses" },
] };

const SPRING_LINES = [
	{ season: "spring", text: "Petrichor smell on a southerly breeze" },
	{ season: "summer", text: "Fireflies like galaxies over the fields at dusk" },
];

describe("SteadingSeason — where the wheel stands", () => {
	it("reads the stored season", () => {
		expect(build({ season: "autumn" }).season.season.key).toBe("autumn");
	});

	// A steading that has never been turned is in winter, so the table's first act is letting spring
	// break forth — the book's own opening move.
	it("is winter with nothing stored", () => {
		expect(build().season.season.key).toBe("winter");
		expect(build().season.year).toBe(1);
	});
});

describe("SteadingSeason.turn", () => {
	it("turns the wheel to the next season", async () => {
		const { actor, season } = build({ season: "spring" });
		await season.turn();
		expect(actor.system.season).toBe("summer");
	});

	// The year turns on the winter→spring wrap and nowhere else.
	it("leaves the year alone within a year", async () => {
		const { actor, season } = build({ season: "autumn", year: 2 });
		await season.turn();
		expect([actor.system.season, actor.system.year]).toEqual(["winter", 2]);
	});

	it("starts a new year when winter gives way to spring", async () => {
		const { actor, season } = build({ season: "winter", year: 2 });
		await season.turn();
		expect([actor.system.season, actor.system.year]).toEqual(["spring", 3]);
	});

	// Clearing the record is what makes the mill's harvest owed again next autumn.
	it("clears what was applied last season", async () => {
		const { actor, season } = build({
			season: "autumn", applied: { "mill:0": { change: { target: "surplus", amount: 1 } } },
		});
		await season.turn();
		expect(actor.system.turnoverApplied).toEqual({});
	});

	// And what this season's steps did to Surplus: next winter's consumption is a new roll.
	it("clears what this season's steps rolled", async () => {
		const { actor, season } = build({ season: "winter" });
		actor.system.seasonStepsApplied = { 0: { total: 5, due: 5, from: 3, to: 0 } };
		await season.turn();
		expect(actor.system.seasonStepsApplied).toEqual({});
	});

	// BY NAME, because Foundry MERGES an object-field update: assigning `{}` — or null and then `{}`,
	// which is what this did — leaves every key exactly where it was, so a season that had been
	// applied still read as applied after the wheel turned. Only `-=key` removes one, and that is a
	// claim about the update this SENDS, which is the whole of the fix.
	it("removes each record by name, since an object update merges", async () => {
		const { actor, season } = build({
			season: "autumn", applied: { "mill:0": { change: { target: "surplus", amount: 1 } } },
		});
		const sent = [];
		const update = actor.update.bind(actor);
		actor.update = data => { sent.push(data); return update(data); };

		await season.turn();
		expect(Object.keys(sent[0])).toContain("system.turnoverApplied.-=mill:0");
		expect(Object.keys(sent[0])).not.toContain("system.turnoverApplied");
	});

	// And the result the last season was living with: a 6- that stayed lit into spring would be the
	// sheet reporting a roll nobody made.
	it("clears the result the season's own move came up", async () => {
		const { actor, season } = build({ season: "winter" });
		actor.system.seasonRollOutcome = "failure";
		await season.turn();
		expect(season.rolledOutcome).toBeNull();
	});

	// The move just rolled is what grants the next gain, so last season's pick cannot stay ticked —
	// and only that group is cleared.
	it("clears the seasonal gain and nothing else", async () => {
		const { actor, season } = build({
			season: "spring",
			choiceValues: { [SEASONAL_GAINS_GROUP]: { bounty: 1 }, "other-group": { keep: 1 } },
		});
		await season.turn();
		expect(actor.system.choiceValues[SEASONAL_GAINS_GROUP]).toBeUndefined();
		expect(actor.system.choiceValues["other-group"]).toEqual({ keep: 1 });
	});
});

// The tier the season's own Seasons Change landed in, kept so the box can light the result the
// table is living with rather than asking them to remember a total.
describe("SteadingSeason — what the season's own move came up", () => {
	const outcome = key => ({ key, label: key });

	it("has no result until the move is rolled", () => {
		expect(build({ season: "winter" }).season.rolledOutcome).toBeNull();
	});

	it("keeps what this season's own move rolled", async () => {
		const { season } = build({ season: "winter" });
		expect(await season.recordRoll("seasons-change-winter", outcome("partial"))).toBe(true);
		expect(season.rolledOutcome).toBe("partial");
	});

	// Every move the steading makes is offered here. The tier an aurochs hunt landed in says nothing
	// about which of winter's three results the steading is living with.
	it("ignores a roll of any other move", async () => {
		const { season } = build({ season: "winter" });
		expect(await season.recordRoll("lead-the-aurochs-hunt", outcome("success"))).toBe(false);
		expect(season.rolledOutcome).toBeNull();
	});

	// A move with no tiers at all — a bare rating roll — lands nowhere, and lighting a row off it
	// would be the sheet inventing a result.
	it("ignores a roll that landed in no tier", async () => {
		const { season } = build({ season: "winter" });
		expect(await season.recordRoll("seasons-change-winter", null)).toBe(false);
		expect(season.rolledOutcome).toBeNull();
	});

	// The box invites the table to roll the season as many times as it asks for, and the row they are
	// living with is the one they just rolled.
	it("keeps the latest roll", async () => {
		const { season } = build({ season: "winter" });
		await season.recordRoll("seasons-change-winter", outcome("success"));
		await season.recordRoll("seasons-change-winter", outcome("failure"));
		expect(season.rolledOutcome).toBe("failure");
	});

	// What the steading has BUILT that waits on this roll is paid by the roll — the row used to carry
	// an Apply asking the table to answer a question the dice had just answered in front of them.
	describe("and what the roll pays", () => {
		const inSummer = (rest = {}) => build({
			season: "summer", owned: ["raincatching"], improvements: [RAINCATCHING], ...rest,
		});

		it("writes the clause the roll landed on", async () => {
			const { actor, season } = inSummer();
			await season.recordRoll("seasons-change-summer", outcome("success"));
			expect(actor.system.attributes.surplus).toBe(1);
		});

		it("writes nothing on a roll the clause does not cover", async () => {
			const { actor, season } = inSummer();
			await season.recordRoll("seasons-change-summer", outcome("failure"));
			expect(actor.system.attributes.surplus).toBe(0);
		});

		// Rolled again because the table asked for it, not because the first one did not count.
		it("pays a second 7+ nothing, and leaves a later miss alone", async () => {
			const { actor, season } = inSummer();
			await season.recordRoll("seasons-change-summer", outcome("success"));
			await season.recordRoll("seasons-change-summer", outcome("partial"));
			await season.recordRoll("seasons-change-summer", outcome("failure"));
			expect(actor.system.attributes.surplus).toBe(1);
		});

		// The tier an aurochs hunt landed in says nothing about the cistern.
		it("pays nothing for a roll of any other move", async () => {
			const { actor, season } = inSummer();
			await season.recordRoll("lead-the-aurochs-hunt", outcome("success"));
			expect(actor.system.attributes.surplus).toBe(0);
		});

		// The cistern is not built, and a 10+ does not fill it.
		it("pays nothing for an improvement that is not built", async () => {
			const { actor, season } = inSummer({ unbuilt: true });
			await season.recordRoll("seasons-change-summer", outcome("success"));
			expect(actor.system.attributes.surplus).toBe(0);
		});

		// Summer's clause in summer only: the record is season-scoped and cleared when the wheel turns.
		it("pays nothing in a season the clause does not fire in", async () => {
			const { actor, season } = inSummer({ season: "winter" });
			await season.recordRoll("seasons-change-winter", outcome("success"));
			expect(actor.system.attributes.surplus).toBe(0);
		});
	});
});

describe("SteadingSeason — the impression the wheel stamps", () => {
	it("stamps a line for the season it turns TO", async () => {
		const { actor, season } = build({ season: "spring", impressions: SPRING_LINES });
		await season.turn(() => 0);
		expect(actor.system.seasonImpression).toBe("Fireflies like galaxies over the fields at dusk");
	});

	it("stamps nothing for a steading with no impressions", async () => {
		const { actor, season } = build({ season: "spring" });
		await season.turn(() => 0);
		expect(actor.system.seasonImpression).toBe("");
	});

	it("carries the stamped line onto the snapshot", async () => {
		const { season } = build({ season: "winter", impressions: [
			{ season: "spring", text: "Petrichor smell on a southerly breeze" },
		] });
		await season.turn(() => 0);
		expect((await season.buildSnapshot()).impression).toBe("Petrichor smell on a southerly breeze");
	});
});

describe("SteadingSeason — the season's statement", () => {
	const linesOf = async opts => (await build(opts).season.buildSnapshot()).statement.lines;

	it("lists a result that fires in the current season", async () => {
		const lines = await linesOf({ season: "autumn", owned: ["mill"], improvements: [MILL] });
		expect(lines.map(l => l.source)).toEqual(["Mill"]);
		expect(lines[0].text.raw).toBe("the steading generates +1 Surplus");
	});

	it("leaves out a result that fires in another season", async () => {
		expect(await linesOf({ season: "winter", owned: ["mill"], improvements: [MILL] })).toEqual([]);
	});

	// The statement is a claim about THIS steading.
	it("says nothing about an improvement it does not own", async () => {
		expect(await linesOf({ season: "autumn", owned: [], improvements: [MILL] })).toEqual([]);
	});

	// A result is the ongoing effect of a FINISHED improvement: the mill generates nothing each
	// autumn until there is a mill.
	it("says nothing about an improvement it has not built", async () => {
		expect(await linesOf({
			season: "autumn", owned: ["mill"], improvements: [MILL], unbuilt: true,
		})).toEqual([]);
	});

	it("leaves out an improvement with no results at all", async () => {
		expect(await linesOf({ season: "autumn", owned: ["palisade"], improvements: [PALISADE] })).toEqual([]);
	});

	it("lists an every-season result in every season", async () => {
		for (const key of ["spring", "summer", "autumn", "winter"]) {
			expect(await linesOf({ season: key, owned: ["standing-watch"], improvements: [WATCH] }))
				.toHaveLength(1);
		}
	});

	// The Herd breeds in summer and eats in winter: one improvement, two results, only the one that
	// fires belongs on the list.
	it("picks the right result of an improvement carrying two", async () => {
		const summer = await linesOf({ season: "summer", owned: ["herd-of-horses"], improvements: [HERD] });
		const winter = await linesOf({ season: "winter", owned: ["herd-of-horses"], improvements: [HERD] });
		expect(summer.map(l => l.text.raw)).toEqual(["the herd gains foals"]);
		expect(winter.map(l => l.text.raw)).toEqual(["the herd consumes 1 Surplus"]);
	});

	// Addressed by what it is ABOUT, so a line keeps its opt-out across a render and two results of
	// one improvement can never share one.
	it("gives each result of an improvement its own id", async () => {
		const winter = await linesOf({ season: "winter", owned: ["herd-of-horses"], improvements: [HERD] });
		expect(winter[0].id).toBe("herd-of-horses:1");
	});

	/**
	 * Both are listed; only the bill is counted. What the steading GENERATES is paid by the season's
	 * generation step, whose record is the step's own — counting it here as well would let "Apply the
	 * season" pay a Surplus that step had already paid.
	 */
	it("counts the season's bills and leaves its gains to the step that generates them", async () => {
		const snap = await build({
			season: "autumn", owned: ["mill", "standing-watch"], improvements: [MILL, WATCH],
			attributes: { surplus: 3 },
		}).season.buildSnapshot();
		expect(snap.statement.lines).toHaveLength(2);
		expect(snap.statement.gains.map(l => l.source)).toEqual(["Mill"]);
		expect(snap.statement.totals.map(t => [t.target, t.delta])).toEqual([["surplus", -1]]);
	});
});

describe("SteadingSeason.applyTurnover", () => {
	// The watch's Surplus, not the mill's: what the steading GENERATES is paid by the season's
	// generation step now, so the turnover's own Apply writes the bills and what is neither.
	const autumn = extra => build({
		season: "autumn", owned: ["standing-watch"], improvements: [WATCH], attributes: { surplus: 2 },
		...extra,
	});

	it("writes what the season does", async () => {
		const { actor, season } = autumn();
		await season.applyTurnover();
		expect(actor.system.attributes.surplus).toBe(1);
	});

	// Six people share this sheet; the second to press it must not pay the season twice.
	it("refuses a second time", async () => {
		const { actor, season } = autumn();
		expect(await season.applyTurnover()).toBe(true);
		expect(await season.applyTurnover()).toBe(false);
		expect(actor.system.attributes.surplus).toBe(1);
	});

	// A gain is listed with the season and written by the step that generates it.
	it("leaves what the steading generates to the generation step", async () => {
		const { actor, season } = autumn({ owned: ["mill"], improvements: [MILL] });
		expect(await season.applyTurnover()).toBe(false);
		expect(actor.system.attributes.surplus).toBe(2);
	});

	it("says on the snapshot that it has been applied", async () => {
		const { season } = autumn();
		expect((await season.buildSnapshot()).applied).toBe(false);
		await season.applyTurnover();
		expect((await season.buildSnapshot()).applied).toBe(true);
	});

	// Every line records what it wrote, so the season's whole record is auditable afterwards rather
	// than being one flag saying that something happened.
	it("records each line it wrote, in the season-scoped store", async () => {
		const { actor, season } = autumn();
		await season.applyTurnover();
		expect(Object.values(actor.system.turnoverApplied).every(r => r.change || r.entry)).toBe(true);
	});

	// A new season is owed its own turnover: the record is season-scoped, so coming round to autumn
	// again finds the same line owed and pays it again.
	it("is owed again when the wheel comes back round", async () => {
		const { actor, season } = autumn();
		await season.applyTurnover();
		const paid = actor.system.attributes.surplus;
		for (let i = 0; i < 4; i++) await season.turn();
		expect((await season.buildSnapshot()).applied).toBe(false);
		await season.applyTurnover();
		expect(actor.system.attributes.surplus).toBeLessThan(paid);
	});
});

describe("SteadingSeason — the moments within a season", () => {
	const autumn = extra => build({
		season: "autumn", owned: ["rhoillyg-orchard"], improvements: [ORCHARD],
		attributes: { surplus: 2 }, ...extra,
	});

	it("lists a moment of this season, with what fires at it", async () => {
		const [moment] = await autumn().season.moments();
		expect(moment.key).toBe("autumn-harvest");
		expect(moment.statement.lines.map(l => l.text.raw)).toEqual(["the orchard yields +1 Surplus"]);
	});

	// The hunt is a spring moment; autumn is not offered it however many aurochs there are.
	it("says nothing about a moment of another season", async () => {
		const { season } = build({
			season: "autumn", owned: ["aurochs-hunting"], improvements: [AUROCHS],
		});
		expect(await season.moments()).toEqual([]);
	});

	// The autumn harvest happens every autumn; a steading with nothing that fires at it is not shown
	// an empty panel headed with a thing it has left undone.
	it("leaves out a moment nothing fires at", async () => {
		expect(await build({ season: "autumn" }).season.moments()).toEqual([]);
	});

	it("leaves out a moment whose improvement is unbuilt", async () => {
		expect(await autumn({ unbuilt: true }).season.moments()).toEqual([]);
	});

	// The hunt is LED by rolling it, so the moment carries the move the sheet offers.
	it("carries the move a moment's result confers", async () => {
		const [moment] = await build({
			season: "spring", owned: ["aurochs-hunting"], improvements: [AUROCHS],
		}).season.moments();
		expect(moment.moveSlug).toBe("lead-the-aurochs-hunt");
	});

	it("says nothing about a move where no result confers one", async () => {
		const [moment] = await autumn().season.moments();
		expect(moment.moveSlug).toBeNull();
	});
});

describe("SteadingSeason.applyMoment", () => {
	const autumn = extra => build({
		season: "autumn", owned: ["rhoillyg-orchard"], improvements: [ORCHARD],
		attributes: { surplus: 2 }, ...extra,
	});

	it("writes what the moment does", async () => {
		const { actor, season } = autumn();
		expect(await season.applyMoment("autumn-harvest")).toBe(true);
		expect(actor.system.attributes.surplus).toBe(3);
	});

	// One harvest per autumn, however many people press it.
	it("refuses a second time", async () => {
		const { actor, season } = autumn();
		await season.applyMoment("autumn-harvest");
		expect(await season.applyMoment("autumn-harvest")).toBe(false);
		expect(actor.system.attributes.surplus).toBe(3);
	});

	it("says on the snapshot that it has been applied", async () => {
		const { season } = autumn();
		await season.applyMoment("autumn-harvest");
		expect((await season.moments())[0].applied).toBe(true);
	});

	// A stale click from a client still showing last season must not pay an autumn harvest in winter.
	it("refuses a moment that cannot happen this season", async () => {
		const { actor, season } = autumn({ season: "winter" });
		expect(await season.applyMoment("autumn-harvest")).toBe(false);
		expect(actor.system.attributes.surplus).toBe(2);
	});

	it("refuses a moment that does not exist", async () => {
		expect(await autumn().season.applyMoment("goose-day")).toBe(false);
	});

	// Next autumn is owed its own harvest — the records are cleared when the wheel turns.
	it("is owed again once the wheel has come round", async () => {
		const { actor, season } = autumn();
		await season.applyMoment("autumn-harvest");
		expect((await season.moments())[0].applied).toBe(true);
		const paid = actor.system.attributes.surplus;

		for (let i = 0; i < 4; i++) await season.turn();
		expect((await season.moments())[0].applied).toBe(false);
		await season.applyMoment("autumn-harvest");
		expect(actor.system.attributes.surplus).toBeGreaterThan(paid);
	});

	it("puts the moment on the turnover snapshot", async () => {
		const snap = await autumn().season.buildSnapshot();
		expect(snap.hasMoments).toBe(true);
		expect(snap.moments.map(m => m.key)).toEqual(["autumn-harvest"]);
	});
});
