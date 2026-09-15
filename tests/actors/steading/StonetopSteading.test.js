import { describe, it, expect } from "vitest";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { SteadingSnapshot } from "../../../src/model/snapshot/steading/SteadingSnapshot.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { steadingRepos, FakeSteadingArtRepository } from "../../fakes/FakeSteadingRepos.js";
import { SeasonStepAddress } from "../../../src/model/data/steading/SeasonStepAddress.js";

const fakeImprovementsRepo = {getBySlug: async () => null};
const fakeMoves = new FakeMoveRepository();

function make() {
	return new StonetopSteading(new FakeSteadingBuilder().build(), steadingRepos({ improvements: fakeImprovementsRepo, moves: fakeMoves }));
}

describe("StonetopSteading.buildSnapshot", () => {
	it("returns a SteadingSnapshot", async () => {
		expect(await make().buildSnapshot()).toBeInstanceOf(SteadingSnapshot);
	});

	it("reflects the stored fortunes value (+1 for Stonetop)", async () => {
		const snap = await make().buildSnapshot();
		expect(snap.fortunes.current).toBe(1);
	});

	it("uses default surplus when no value set", async () => {
		const snap = await make().buildSnapshot();
		expect(snap.surplus.current).toBe(1);
	});

	it("defaults notes to empty string", async () => {
		expect((await make().buildSnapshot()).notes).toBe("");
	});

	it("snapshot includes debilities from SteadingDebilities", async () => {
		expect((await make().buildSnapshot()).debilities).toHaveLength(3);
	});

	it("snapshot includes the one roster of folk", async () => {
		expect((await make().buildSnapshot()).folk).toEqual([]);
	});

	it("snapshot includes the neighbouring places", async () => {
		const snap = await make().buildSnapshot();
		expect(snap.neighborPlaces).toHaveLength(6);
	});

	it("snapshot includes content sections from SteadingContent", async () => {
		expect((await make().buildSnapshot()).content).toHaveLength(3);
	});

	// The whisky jugs under the Resources list, and only in a world that installed them — the default
	// fake art store has nothing, which is the world of anyone who has never run the installer.
	it("carries no resources plate when the art store has none", async () => {
		expect((await make().buildSnapshot()).resourcesPlate).toBeNull();
	});

	it("carries the resources plate the art store provides", async () => {
		const steading = new StonetopSteading(new FakeSteadingBuilder().build(), steadingRepos({
			improvements: fakeImprovementsRepo,
			moves: fakeMoves,
			art: new FakeSteadingArtRepository({ resources: "stonetop-art/wonders/plate.png" }),
		}));
		expect((await steading.buildSnapshot()).resourcesPlate).toBe("stonetop-art/wonders/plate.png");
	});

	// The four villagers closing the Folk roster, on the same terms: the Folk tab asks the snapshot
	// before it draws, so a world without the art links nothing rather than a path that 404s.
	it("carries no residents plate when the art store has none", async () => {
		expect((await make().buildSnapshot()).residentsPlate).toBeNull();
	});

	it("carries the residents plate the art store provides", async () => {
		const steading = new StonetopSteading(new FakeSteadingBuilder().build(), steadingRepos({
			improvements: fakeImprovementsRepo,
			moves: fakeMoves,
			art: new FakeSteadingArtRepository({ residents: "stonetop-art/steading/residents.png" }),
		}));
		expect((await steading.buildSnapshot()).residentsPlate).toBe("stonetop-art/steading/residents.png");
	});
});

describe("StonetopSteading — fortunes", () => {
	it("setFortunes is reflected in snapshot", async () => {
		const s = make();
		await s.setFortunes(4);
		expect((await s.buildSnapshot()).fortunes.current).toBe(4);
	});

	it("steps between the ends of the book's range", async () => {
		const s = make();
		await s.setFortunes(3);
		const fortunes = (await s.buildSnapshot()).fortunes;
		expect(fortunes.current).toBe(3);
		expect(fortunes.min).toBe(-1);
		expect(fortunes.max).toBe(3);
		// A ±N rating steps; it has no list to pick from.
		expect(fortunes.isNumeric).toBe(true);
		expect(fortunes.options).toEqual([]);
	});
});

describe("StonetopSteading — surplus", () => {
	it("setSurplus is reflected in snapshot", async () => {
		const s = make();
		await s.setSurplus(5);
		expect((await s.buildSnapshot()).surplus.current).toBe(5);
	});
});

describe("StonetopSteading — notes", () => {
	it("setNotes is reflected in snapshot", async () => {
		const s = make();
		await s.setNotes("hello world");
		expect((await s.buildSnapshot()).notes).toBe("hello world");
	});
});

// -- Rolling interface ---------------------------------------------------------

// A step of the season's move that rolls dice of its own — winter's 1d4+Population. Not every roll
// a move calls for lands on 10+/7-9/6-: this one is a NUMBER, and reading it as a move result would
// put "success" on a 10 that means ten Surplus gone.
//
// Addressed by its INDEX: the dice, the rating, which way it moves Surplus and what this steading's
// improvements do to all three are answered by the step itself, from the season's own move.

// The season's move as it sits on the actor — an embedded copy, which is how every steading carries
// its moves, so the step the roll finds is the one the sheet drew.
const seasonMove = (season, steps, moveResults = null) => ({
	_id: `move-${season}`, name: `Seasons Change: ${season}`, type: "move",
	system: { slug: `seasons-change-${season}`, categoryKey: "seasons", moveType: "seasons",
		description: "", rollStat: "fortunes", steps, moveResults },
});

// Winter's own results. Its 7-9 and 6- each consume a SECOND 1d4+Population, which the move states
// in its results and the step hangs its dice on.
const WINTER_RESULTS = {
	success: { label: "10+", value: "The winter is relatively mild." },
	partial: { label: "7-9", value: "Consume additional Surplus equal to 1d4+Population." },
	failure: { label: "6-",  value: "As a 7-9, but also threats abound." },
};

const WINTER_TIERED = {
	kind: "roll", stat: "fortunes", tiers: true, text: "Then, roll +Fortunes.",
	results: {
		partial: { die: "1d4", stat: "population", affects: "consumption" },
		failure: { die: "1d4", stat: "population", affects: "consumption" },
	},
};

const WINTER_STEPS = [
	{ kind: "roll", die: "1d4", stat: "population", affects: "consumption", text: "rolls 1d4+Population" },
	{ kind: "consume", affects: "consumption", text: "consumes that much" },
	{ kind: "roll", stat: "fortunes", tiers: true, text: "Then, roll +Fortunes." },
];

describe("StonetopSteading.rollSeasonStep", () => {
	const withRecorder = (total = null, { season = "winter", steps = WINTER_STEPS } = {}) => {
		const actor = new FakeSteadingBuilder().build();
		actor.system.season = season;
		actor.items.push(seasonMove(season, steps));
		const rolled = [];
		actor.evaluateFormula = async formula => { rolled.push({ formula }); return { total }; };
		actor.postFormulaCard = async card => rolled[rolled.length - 1].card = card;
		const steading = new StonetopSteading(actor, steadingRepos({
			improvements: fakeImprovementsRepo, moves: fakeMoves,
		}));
		return { actor, rolled, steading };
	};

	it("adds the rating at its current value", async () => {
		const { actor, rolled, steading } = withRecorder();
		actor.system.attributes.population = 2;
		expect(await steading.rollSeasonStep(0)).toBe(true);
		expect(rolled[0].formula).toBe("1d4 + 2");
	});

	// Through the same resolveBonus every other roll on this sheet goes through, debilities and all
	// — a rating rolled here at its stored value rather than its effective one would be the only
	// place on the sheet that disagreed about what the rating is. (Only `lacking` bends a rating
	// today, and it bends Prosperity; no season step names it, so the mechanism is what is asserted.)
	it("rolls the rating as the steading's debilities leave it", async () => {
		const { actor, rolled, steading } = withRecorder(null, {
			steps: [{ kind: "roll", die: "1d4", stat: "prosperity" }],
		});
		actor.system.attributes.prosperity = 2;
		actor.system.debilities = { ...actor.system.debilities, lacking: true };
		await steading.rollSeasonStep(0);
		expect(rolled[0].formula).toBe("1d4 + 1");
	});

	// Null from resolveBonus means "not a rating at all", which is not the same as a rating at 0 —
	// a step naming something the steading does not have rolls nothing rather than rolling bare dice.
	it("rolls nothing for a rating the steading does not have", async () => {
		const { rolled, steading } = withRecorder(null, {
			steps: [{ kind: "roll", die: "1d4", stat: "courage" }],
		});
		expect(await steading.rollSeasonStep(0)).toBe(false);
		expect(rolled).toHaveLength(0);
	});

	it("rolls bare dice when the step adds no rating", async () => {
		const { rolled, steading } = withRecorder(null, { steps: [{ kind: "generate", die: "1d4-1" }] });
		await steading.rollSeasonStep(0);
		expect(rolled[0].formula).toBe("1d4-1 + 0");
	});

	it("rolls nothing for a step that names no dice", async () => {
		const { rolled, steading } = withRecorder();
		expect(await steading.rollSeasonStep(1)).toBe(false);
		expect(rolled).toHaveLength(0);
	});

	// The move's own roll is not this control's: it posts a card with tiers and leaves Surplus alone.
	it("rolls nothing for the move's own tiered roll", async () => {
		const { rolled, steading } = withRecorder();
		expect(await steading.rollSeasonStep(2)).toBe(false);
		expect(rolled).toHaveLength(0);
	});

	it("rolls nothing for a step that is not there", async () => {
		const { rolled, steading } = withRecorder();
		expect(await steading.rollSeasonStep(9)).toBe(false);
		expect(rolled).toHaveLength(0);
	});
});

// The card the roll posts. "Roll 1d4 + Population" is what a BUTTON says; a chat card is a record,
// so it is titled by what the season did and carries the formula as its receipt.
describe("StonetopSteading.rollSeasonStep — the card it posts", () => {
	const cardFor = async (steps, { season = "winter", total = 3, surplus = 5 } = {}) => {
		const actor = new FakeSteadingBuilder().build();
		actor.system.season = season;
		actor.system.attributes.surplus    = surplus;
		actor.system.attributes.population = 2;
		actor.items.push(seasonMove(season, steps));
		let posted = null;
		actor.evaluateFormula = async () => ({ total });
		actor.postFormulaCard = async card => { posted = card; };
		const steading = new StonetopSteading(actor, steadingRepos({
			improvements: fakeImprovementsRepo, moves: fakeMoves,
		}));
		await steading.rollSeasonStep(0);
		return posted;
	};

	it("titles the card by the season and the side of it the step is on", async () => {
		const card = await cardFor(WINTER_STEPS);
		expect(card.name).toBe("stonetop.steading.seasons.names.winter — Consumption");
	});

	it("titles a generation step by what it generates", async () => {
		const card = await cardFor([{ kind: "generate", die: "1d4-1", affects: "generation" }],
			{ season: "summer" });
		expect(card.name).toBe("stonetop.steading.seasons.names.summer — Generation");
	});

	// A homebrew step that names no direction moves nothing, so there is nothing to name it by.
	it("titles a step that says which way nothing goes by the roll alone", async () => {
		const card = await cardFor([{ kind: "roll", die: "1d4", stat: "population" }]);
		expect(card.name).toBe("stonetop.steading.seasons.names.winter — Roll");
	});

	// The rating NAMED, not the number it came to — the dice row prints that beside it.
	it("carries the formula with the rating named", async () => {
		const card = await cardFor(WINTER_STEPS);
		expect(card.formula).toBe("1d4 + stonetop.steading.attr.population");
	});

	it("carries bare dice as the formula when the step adds no rating", async () => {
		const card = await cardFor([{ kind: "generate", die: "1d4-1", affects: "generation" }]);
		expect(card.formula).toBe("1d4-1");
	});

	it("hands the card the evaluated roll, so the dice animate", async () => {
		const card = await cardFor(WINTER_STEPS);
		expect(card.roll.total).toBe(3);
	});

	// Applied BEFORE it is reported: what the roll did to Surplus is the news, and it is not known
	// until it has been done.
	it("carries what the roll did to Surplus", async () => {
		const card = await cardFor(WINTER_STEPS);
		expect({ from: card.applied.from, to: card.applied.to }).toEqual({ from: 5, to: 2 });
	});

	it("carries no record for a step that moves nothing", async () => {
		const card = await cardFor([{ kind: "roll", die: "1d4", stat: "population" }]);
		expect(card.applied).toBeNull();
	});
});

// The roll used to post a card and stop, which left the table doing the one piece of arithmetic the
// sheet had just performed for them. `affects` is the STEP's own word for which way its result moves
// Surplus, so the sign comes off the move's data rather than being guessed from the dice.
describe("StonetopSteading.rollSeasonStep — moving Surplus", () => {
	const withRecorder = (total, { steps = WINTER_STEPS } = {}) => {
		const actor = new FakeSteadingBuilder().build();
		actor.system.season = "winter";
		actor.items.push(seasonMove("winter", steps));
		actor.evaluateFormula = async () => ({ total });
		actor.postFormulaCard = async () => {};
		const steading = new StonetopSteading(actor, steadingRepos({
			improvements: fakeImprovementsRepo, moves: fakeMoves,
		}));
		return { actor, steading };
	};

	it("spends what a consumption step rolled", async () => {
		const { actor, steading } = withRecorder(3);
		actor.system.attributes.surplus = 5;
		await steading.rollSeasonStep(0);
		expect(actor.system.attributes.surplus).toBe(2);
	});

	// "If there's not enough, reduce Surplus to 0 and Meet with Disaster." The floor is the book's;
	// the Disaster is the table's, and the step's own text is what says so.
	it("floors consumption at 0 rather than going negative", async () => {
		const { actor, steading } = withRecorder(6);
		actor.system.attributes.surplus = 2;
		await steading.rollSeasonStep(0);
		expect(actor.system.attributes.surplus).toBe(0);
	});

	it("gains what a generation step rolled", async () => {
		const { actor, steading } = withRecorder(2, {
			steps: [{ kind: "generate", die: "1d4-1", affects: "generation" }],
		});
		actor.system.attributes.surplus = 1;
		await steading.rollSeasonStep(0);
		expect(actor.system.attributes.surplus).toBe(3);
	});

	// A step that names no direction is a roll and nothing more — a homebrew Seasons Change, or a
	// step whose dice decide something the sheet does not hold.
	it("moves nothing for a step that does not say which way", async () => {
		const { actor, steading } = withRecorder(3, {
			steps: [{ kind: "roll", die: "1d4", stat: "population" }],
		});
		actor.system.attributes.surplus = 5;
		await steading.rollSeasonStep(0);
		expect(actor.system.attributes.surplus).toBe(5);
	});
});

// The second consumption winter's 7-9 and 6- call for. It is the same roll made in a different
// place, so it goes through the same handler, addressed by the tier it belongs to rather than by a
// step index it does not have.
describe("StonetopSteading.rollSeasonStep — a result of the move's own roll", () => {
	const winter = (total, { surplus = 6, population = 2 } = {}) => {
		const actor = new FakeSteadingBuilder().build();
		actor.system.season = "winter";
		actor.system.attributes.surplus    = surplus;
		actor.system.attributes.population = population;
		actor.items.push(seasonMove("winter", [
			{ kind: "roll", die: "1d4", stat: "population", affects: "consumption" },
			WINTER_TIERED,
		], WINTER_RESULTS));
		const rolled = [];
		actor.evaluateFormula = async formula => { rolled.push({ formula }); return { total }; };
		actor.postFormulaCard = async card => rolled[rolled.length - 1].card = card;
		const steading = new StonetopSteading(actor, steadingRepos({
			improvements: fakeImprovementsRepo, moves: fakeMoves,
		}));
		return { actor, rolled, steading };
	};

	it("rolls the tier's own dice, with the rating added at its current value", async () => {
		const { rolled, steading } = winter(3);
		expect(await steading.rollSeasonStep(SeasonStepAddress.of(1, "partial"))).toBe(true);
		expect(rolled[0].formula).toBe("1d4 + 2");
	});

	it("consumes what it rolled", async () => {
		const { actor, steading } = winter(3);
		await steading.rollSeasonStep(SeasonStepAddress.of(1, "failure"));
		expect(actor.system.attributes.surplus).toBe(3);
	});

	// Recorded apart from the step's, so rolling the 7-9 does not read as having rolled winter's
	// opening consumption, and either can be given back on its own.
	it("records what it did against its own tier", async () => {
		const { actor, steading } = winter(3);
		await steading.rollSeasonStep(SeasonStepAddress.of(1, "partial"));
		expect(actor.system.seasonStepsApplied["1:partial"]).toEqual({ total: 3, due: 3, from: 6, to: 3 });
		expect(actor.system.seasonStepsApplied["1"]).toBeUndefined();
	});

	it("gives it back on its own", async () => {
		const { actor, steading } = winter(3);
		await steading.rollSeasonStep(SeasonStepAddress.of(1, "partial"));
		expect(await steading.revertSeasonStep(SeasonStepAddress.of(1, "partial"))).toBe(true);
		expect(actor.system.attributes.surplus).toBe(6);
		expect(actor.system.seasonStepsApplied["1:partial"]).toBeUndefined();
	});

	// Winter's two consumptions are two rolls: paying one leaves the other still to make.
	it("leaves the season's opening consumption still to roll", async () => {
		const { actor, steading } = winter(3);
		await steading.rollSeasonStep(SeasonStepAddress.of(1, "partial"));
		await steading.rollSeasonStep(SeasonStepAddress.of(0));
		expect(actor.system.attributes.surplus).toBe(0);
		expect(Object.keys(actor.system.seasonStepsApplied).sort()).toEqual(["0", "1:partial"]);
	});

	// A mild winter costs nothing, so there is nothing to roll on it.
	it("rolls nothing for a result that costs nothing", async () => {
		const { rolled, steading } = winter(3);
		expect(await steading.rollSeasonStep(SeasonStepAddress.of(1, "success"))).toBe(false);
		expect(rolled).toHaveLength(0);
	});

	// A control whose dataset went missing addresses nothing, rather than addressing step 0 —
	// winter's whole consumption.
	it("rolls nothing for an address that is not one", async () => {
		const { rolled, steading } = winter(3);
		expect(await steading.rollSeasonStep(null)).toBe(false);
		expect(await steading.rollSeasonStep(SeasonStepAddress.parse("1:mild"))).toBe(false);
		expect(rolled).toHaveLength(0);
	});
});

describe("StonetopSteading.rollMode", () => {
	it("always returns 'def'", () => {
		expect(make().rollMode).toBe("normal");
	});
});

describe("StonetopSteading.getRollableStats", () => {
	it("returns 4 entries", () => {
		expect(make().getRollableStats()).toHaveLength(4);
	});

	// The stored `current` is an index into the bonuses array [-1, 0, 1, 2, 3];
	// the value shown/rolled is the bonus it points at, not the index. Default current 1 → +0.
	it("includes population with its bonus value (index 1 → +0)", () => {
		const stat = make().getRollableStats().find(s => s.key === "population");
		expect(stat).toBeDefined();
		expect(stat.value).toBe(0);
	});

	it("includes prosperity with its bonus value (index 1 → +0)", () => {
		const stat = make().getRollableStats().find(s => s.key === "prosperity");
		expect(stat).toBeDefined();
		expect(stat.value).toBe(0);
	});

	it("includes defenses with its bonus value (index 1 → +0)", () => {
		const stat = make().getRollableStats().find(s => s.key === "defenses");
		expect(stat).toBeDefined();
		expect(stat.value).toBe(0);
	});

	it("includes fortunes with its bonus value (index 2 → +1)", () => {
		const stat = make().getRollableStats().find(s => s.key === "fortunes");
		expect(stat).toBeDefined();
		expect(stat.value).toBe(1);
	});

	it("reflects a raised attribute value directly", async () => {
		const s = make();
		await s.setAttribute("population", 3); // +3
		expect(s.getRollableStats().find(x => x.key === "population").value).toBe(3);
	});
});

describe("StonetopSteading.resolveBonus", () => {
	// Ratings are stored as their actual value now; resolveBonus just returns it.
	it("returns population's stored value (+0)", () => {
		expect(make().resolveBonus("population")).toBe(0);
	});

	it("returns prosperity's stored value (+0)", () => {
		expect(make().resolveBonus("prosperity")).toBe(0);
	});

	it("returns defenses' stored value (+0)", () => {
		expect(make().resolveBonus("defenses")).toBe(0);
	});

	it("returns fortunes' stored value (+1)", () => {
		expect(make().resolveBonus("fortunes")).toBe(1);
	});

	it("returns a lowered attribute value (-1)", async () => {
		const s = make();
		await s.setAttribute("defenses", -1);
		expect(s.resolveBonus("defenses")).toBe(-1);
	});

	it("returns a raised attribute value (+3)", async () => {
		const s = make();
		await s.setAttribute("prosperity", 3);
		expect(s.resolveBonus("prosperity")).toBe(3);
	});

	it("returns surplus as its raw value (not index-mapped)", async () => {
		const s = make();
		await s.setSurplus(3);
		expect(s.resolveBonus("surplus")).toBe(3);
	});

	it("returns null for unknown rollStat", () => {
		expect(make().resolveBonus("str")).toBeNull();
	});
});

describe("StonetopSteading.applyRollMode", () => {
	it("passes rollMode through unchanged with no debility marked", () => {
		expect(make().applyRollMode("population", "adv")).toBe("adv");
		expect(make().applyRollMode("fortunes", "normal")).toBe("normal");
		expect(make().applyRollMode("defenses", "dis")).toBe("dis");
	});

	async function diminished() {
		const s = make();
		await s.setDebility("diminished", true);
		return s;
	}

	it("hinders each of the three moves diminished names", async () => {
		const s = await diminished();
		expect(s.applyRollMode("defenses", "normal", "deploy")).toBe("dis");
		expect(s.applyRollMode("population", "normal", "muster")).toBe("dis");
		expect(s.applyRollMode("population", "normal", "pull-together")).toBe("dis");
	});

	it("cancels advantage on a hindered move", async () => {
		expect((await diminished()).applyRollMode("defenses", "adv", "deploy")).toBe("normal");
	});

	// Diminished is scoped to named moves, not to the ratings they happen to roll: Trade & Barter and
	// a bare Population roll share their stats with hindered moves and must stay untouched.
	it("leaves a move diminished does not name alone", async () => {
		expect((await diminished()).applyRollMode("prosperity", "normal", "trade-barter")).toBe("normal");
	});

	it("leaves a bare rating roll alone", async () => {
		expect((await diminished()).applyRollMode("population", "normal", null)).toBe("normal");
	});

	it("does not hinder moves while only lacking is marked", async () => {
		const s = make();
		await s.setDebility("lacking", true);
		expect(s.applyRollMode("defenses", "normal", "deploy")).toBe("normal");
	});
});

// What a character's expedition page asks of the steading it calls home. Named reads, so the
// caller never spells an attribute key or a debility slug.
describe("StonetopSteading — prosperity as characters read it", () => {
	it("reports name and the stored rating as the bonus", () => {
		const actor = new FakeSteadingBuilder().build();
		actor.system.attributes.prosperity = 2;
		const s = new StonetopSteading(actor, steadingRepos({ improvements: fakeImprovementsRepo, moves: fakeMoves }));
		expect(s.name).toBe("Stonetop");
		expect(s.prosperity).toBe(2);
		expect(s.isLacking).toBe(false);
	});

	// The book: while a steading is *lacking*, treat its Prosperity as 1 lower. That belongs to the
	// steading, so nothing downstream — character sheets, the gear table, rolls — repeats the rule.
	it("reads 1 lower while the steading is lacking", () => {
		const actor = new FakeSteadingBuilder().build();
		actor.system.attributes.prosperity = 2;
		actor.system.debilities.lacking = true;
		const s = new StonetopSteading(actor, steadingRepos({ improvements: fakeImprovementsRepo, moves: fakeMoves }));
		expect(s.prosperity).toBe(1);
		expect(s.isLacking).toBe(true);
	});

	it("lacking drops the prosperity roll bonus too", () => {
		const actor = new FakeSteadingBuilder().build();
		actor.system.attributes.prosperity = 0;
		actor.system.debilities.lacking = true;
		expect(new StonetopSteading(actor, steadingRepos({ improvements: fakeImprovementsRepo, moves: fakeMoves })).resolveBonus("prosperity")).toBe(-1);
	});

	it("lacking leaves the other ratings alone", () => {
		const actor = new FakeSteadingBuilder().build();
		actor.system.attributes.fortunes   = 1;
		actor.system.attributes.defenses   = 2;
		actor.system.attributes.population = 1;
		actor.system.debilities.lacking    = true;
		const s = new StonetopSteading(actor, steadingRepos({ improvements: fakeImprovementsRepo, moves: fakeMoves }));
		expect(s.resolveBonus("fortunes")).toBe(1);
		expect(s.resolveBonus("defenses")).toBe(2);
		expect(s.resolveBonus("population")).toBe(1);
	});

	// The GM's rating panel reads the stored attribute, so the adjustment must not follow it there.
	it("does not change the stored rating", () => {
		const actor = new FakeSteadingBuilder().build();
		actor.system.attributes.prosperity = 2;
		actor.system.debilities.lacking = true;
		new StonetopSteading(actor, steadingRepos({ improvements: fakeImprovementsRepo, moves: fakeMoves })).prosperity;
		expect(actor.system.attributes.prosperity).toBe(2);
	});

	it("defaults to +0 / not lacking on a fresh steading", () => {
		expect(make().prosperity).toBe(0);
		expect(make().isLacking).toBe(false);
	});

	it("carries a negative rating through", () => {
		const actor = new FakeSteadingBuilder().build();
		actor.system.attributes.prosperity = -1;
		expect(new StonetopSteading(actor, steadingRepos({ improvements: fakeImprovementsRepo, moves: fakeMoves })).prosperity).toBe(-1);
	});
});

// A roll that moves Surplus with nothing on screen to say why is worse than no automation at all —
// the number changes and the reader has to go and read the chat log to find out what happened. The
// step records what it did, says so, and offers it back.
describe("StonetopSteading.revertSeasonStep", () => {
	const rolled = async (total, affects, surplus) => {
		const actor = new FakeSteadingBuilder().build();
		actor.system.season = "winter";
		actor.items.push(seasonMove("winter", [{ kind: "roll", die: "1d4", affects }]));
		actor.evaluateFormula = async () => ({ total });
		actor.postFormulaCard = async () => {};
		actor.system.attributes.surplus = surplus;
		const steading = new StonetopSteading(actor, steadingRepos({
			improvements: fakeImprovementsRepo, moves: fakeMoves,
		}));
		await steading.rollSeasonStep(0);
		return { actor, steading };
	};

	it("records what the roll did to Surplus", async () => {
		const { actor } = await rolled(3, "consumption", 5);
		expect(actor.system.seasonStepsApplied["0"]).toEqual({ total: 3, due: 3, from: 5, to: 2 });
	});

	it("gives back what a consumption step took", async () => {
		const { actor, steading } = await rolled(3, "consumption", 5);
		await steading.revertSeasonStep(0);
		expect(actor.system.attributes.surplus).toBe(5);
	});

	it("takes back what a generation step paid", async () => {
		const { actor, steading } = await rolled(2, "generation", 1);
		await steading.revertSeasonStep(0);
		expect(actor.system.attributes.surplus).toBe(1);
	});

	// The floor means the delta is not always the roll: a 6 against 2 Surplus spends 2, so reverting
	// gives back 2. Restoring `from` would agree here and disagree the moment anyone edited Surplus
	// in between, which is why the record is read as a delta.
	it("gives back only what a short consumption actually took", async () => {
		const { actor, steading } = await rolled(6, "consumption", 2);
		expect(actor.system.attributes.surplus).toBe(0);
		await steading.revertSeasonStep(0);
		expect(actor.system.attributes.surplus).toBe(2);
	});

	// Reverted, the step offers the roll again — so the record has to be gone, not merely zeroed.
	it("forgets the record, so the step offers its roll again", async () => {
		const { actor, steading } = await rolled(3, "consumption", 5);
		await steading.revertSeasonStep(0);
		expect(actor.system.seasonStepsApplied["0"]).toBeUndefined();
	});

	it("does nothing for a step that was never rolled", async () => {
		const { actor, steading } = await rolled(3, "consumption", 5);
		expect(await steading.revertSeasonStep(1)).toBe(false);
		expect(actor.system.attributes.surplus).toBe(2);
	});
});
