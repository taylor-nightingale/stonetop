import { describe, it, expect } from "vitest";
import { SteadingSeasons } from "../../../src/actors/steading/SteadingSeasons.js";
import { SteadingChoices } from "../../../src/actors/steading/SteadingChoices.js";
import { SteadingMoves } from "../../../src/actors/steading/SteadingMoves.js";
import { Seasons } from "../../../src/model/data/steading/Seasons.js";
import { SEASONAL_GAINS_GROUP } from "../../../src/model/data/steading/SeasonalPicks.js";
import { ChoiceTarget } from "../../../src/actors/character/ChoiceTarget.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../../fakes/FakeCompendiumMoveBuilder.js";
import { FakeSteadingArtRepository, steadingRepos } from "../../fakes/FakeSteadingRepos.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { SteadingSeason } from "../../../src/actors/steading/SteadingSeason.js";
import { SteadingImprovements } from "../../../src/actors/steading/SteadingImprovements.js";
import { SteadingEffects } from "../../../src/actors/steading/SteadingEffects.js";

// The procedure the move carries — what each season actually does. Spring's is the simple three;
// winter's is the one the sheet used to draw as spring's.
const STEPS = {
	spring: [{ kind: "roll", stat: "fortunes", tiers: true },
	         { kind: "pick", from: "seasonal-gains", count: 1 },
	         { kind: "reset", target: "fortunes" }],
	summer: [{ kind: "roll", stat: "fortunes", tiers: true },
	         { kind: "pick", from: "seasonal-gains", count: 2 },
	         { kind: "generate", die: "1d4-1" },
	         { kind: "reset", target: "fortunes" }],
	autumn: [{ kind: "roll", stat: "fortunes", tiers: true },
	         { kind: "pick", from: "seasonal-gains", count: 1 },
	         { kind: "moment", moment: "autumn-harvest", die: "1d4" },
	         { kind: "reset", target: "fortunes" }],
	winter: [{ kind: "roll", die: "1d4", stat: "population" },
	         { kind: "consume" },
	         { kind: "pick", from: "winter-losses", count: 1 },
	         { kind: "roll", stat: "fortunes", tiers: true },
	         { kind: "reset", target: "fortunes" }],
};

// The move's own authored results, where a test is about the rows the tiered step draws.
const RESULTS = {
	success: { label: "10+", value: "a mild season" },
	partial: { label: "7-9", value: "it costs you" },
	failure: { label: "6-",  value: "it costs you more" },
};

const seasonMove = (name, { results = null } = {}) => new FakeCompendiumMoveBuilder()
	.withName(name)
	.withMoveType("seasons")
	.withSteps(STEPS[name.replace("Seasons Change: ", "").toLowerCase()] ?? [])
	.withMoveResults(results)
	.build();

// A real SteadingMoves behind it: SteadingSeasons asks for its own category by key, so a fake that
// just handed back a category would prove nothing about that wiring.
function build({ moveNames = [], plate = null, results = null } = {}) {
	const actor = new FakeSteadingBuilder().build();
	const repo  = new FakeMoveRepository();
	moveNames.forEach(n => repo.addBasic(seasonMove(n, { results })));
	const choices = new SteadingChoices(actor);
	const moves   = new SteadingMoves(actor, repo);
	const repos   = steadingRepos({ moves: repo });
	// A real SteadingSeason behind it too: the tab's snapshot carries the turnover, and a fake would
	// prove nothing about the composition this class exists to do.
	const season  = new SteadingSeason(
		actor,
		new SteadingEffects(actor, new SteadingImprovements(actor, repos.improvements)),
		choices,
	);
	const seasons = new SteadingSeasons(choices, moves, new FakeSteadingArtRepository({ seasons: plate }), season);
	// Picks are made the way the sheet makes them — through the steading — so the store this reads
	// back from is genuinely the one the registry routes to.
	const steading = new StonetopSteading(actor, repos);
	return { actor, choices, moves, seasons, season, steading };
}

// The pack names the four moves after the seasons; the season itself now carries only a translation
// key, so the printed name is spelled out here rather than read off the model.
const NAMES = { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" };
const allFour = () => Seasons.all().map(s => `Seasons Change: ${NAMES[s.key]}`);

// A pick as the SHEET sends one. `siblingsCsv` is what a radio row carries so choosing one releases
// the rest — the row itself only emits it at pickCount 1, so a summer pick (2) carries none, which is
// exactly what lets two stand at once.
const gainTarget = key => new ChoiceTarget({
	context: "steading", group: SEASONAL_GAINS_GROUP, option: key,
	siblingsCsv: "population,tor,bounty,trade,news,insight",
});
const multiGainTarget = key => new ChoiceTarget({
	context: "steading", group: SEASONAL_GAINS_GROUP, option: key, siblingsCsv: null,
});
const pickRow = snapshot => snapshot.pick.group.list[0];
const picked  = snapshot => pickRow(snapshot).options.filter(o => o.checked).map(o => o.slug);

describe("SteadingSeasons.buildSnapshot", () => {
	// The tab hands over the ordinary MoveCategorySnapshot — the glyphs ride on each move's own icon,
	// so this renders through the same move-group as the Moves tab.
	it("hands over the seasons move category, in the book's order", async () => {
		const { seasons, moves } = build({ moveNames: allFour() });
		await moves.seedReferenceMoves();

		const snapshot = await seasons.buildSnapshot();

		expect(snapshot.moves.key).toBe(Seasons.CATEGORY);
		expect(snapshot.moves.moves.map(m => m.slug)).toEqual(Seasons.moveSlugs());
	});

	// The tier the season's own move came up travels with the steps, so the box lights the row the
	// dice landed on. It is the steading's own record, not something the snapshot works out.
	it("lights the result the season's own move came up", async () => {
		const { seasons, moves, season } = build({ moveNames: allFour(), results: RESULTS });
		await moves.seedReferenceMoves();
		await season.recordRoll(season.season.moveSlug, { key: "partial", label: "7-9" });

		const tiers = (await seasons.buildSnapshot()).steps.find(step => step.hasTiers).tiers;
		expect(tiers.filter(t => t.isRolled).map(t => t.key)).toEqual(["partial"]);
	});

	it("lights nothing on a season nobody has rolled", async () => {
		const { seasons, moves } = build({ moveNames: allFour(), results: RESULTS });
		await moves.seedReferenceMoves();

		const tiers = (await seasons.buildSnapshot()).steps.find(step => step.hasTiers).tiers;
		expect(tiers.some(t => t.isRolled)).toBe(false);
	});

	it("drops a season whose move the steading no longer carries", async () => {
		const { seasons, moves } = build({ moveNames: ["Seasons Change: Spring"] });
		await moves.seedReferenceMoves();
		expect((await seasons.buildSnapshot()).moves.moves).toHaveLength(1);
	});

	it("has no move category at all when the steading carries none of them", async () => {
		expect((await build().seasons.buildSnapshot()).moves).toBeNull();
	});

	// The choice the season the steading is IN hands the table, built from THAT season's own move.
	// It was hardcoded to the gains at "pick 1": summer offered one where its move gives two, and
	// winter — which grants no gains and takes something instead — was handed the gains list.
	describe("the season's pick", () => {
		const inSeason = async (season, moveNames = allFour()) => {
			const built = build({ moveNames });
			built.actor.system.season = season;
			await built.moves.seedReferenceMoves();
			return built;
		};

		it("offers all six gains as one pick-1 row in spring", async () => {
			const { seasons } = await inSeason("spring");
			const row = pickRow(await seasons.buildSnapshot());
			expect(row.options).toHaveLength(6);
			expect(row.radio).toBe(true);
		});

		// Summer's move gives 2 on a 10+. Offering more than one is what stops the options being
		// radios — and radios are what made a second pick release the first.
		it("offers two in summer, because summer's move does", async () => {
			const { seasons, steading } = await inSeason("summer");
			expect(pickRow(await seasons.buildSnapshot()).radio).toBe(false);

			await steading.setChoicePickFor(multiGainTarget("tor"), true);
			await steading.setChoicePickFor(multiGainTarget("news"), true);
			expect(picked(await seasons.buildSnapshot()).sort()).toEqual(["news", "tor"]);
		});

		// Winter grants no gains at all — it takes.
		it("offers winter its own losses, not the gains", async () => {
			const { seasons } = await inSeason("winter");
			const row = pickRow(await seasons.buildSnapshot());
			expect(row.options).toHaveLength(4);
			expect(row.options.map(o => o.slug)).toEqual(["population", "resource", "npc", "pc"]);
		});

		it("marks the pick stored in the steading's choice values", async () => {
			const { seasons, steading } = await inSeason("spring");
			await steading.setChoicePickFor(gainTarget("tor"), true);
			expect(picked(await seasons.buildSnapshot())).toEqual(["tor"]);
		});

		it("replaces the previous pick rather than accumulating", async () => {
			const { seasons, steading } = await inSeason("spring");
			await steading.setChoicePickFor(gainTarget("tor"), true);
			await steading.setChoicePickFor(gainTarget("news"), true);
			expect(picked(await seasons.buildSnapshot())).toEqual(["news"]);
		});

		// A steading whose season move the GM deleted has nothing to pick from — not an empty picker
		// headed "Pick 1", which would read as a thing left undone.
		it("hands over no pick at all when the season's move is gone", async () => {
			const { seasons } = await inSeason("winter", ["Seasons Change: Spring"]);
			expect((await seasons.buildSnapshot()).pick).toBeNull();
		});
	});

	// Installer-provided. Referencing it in a world that never installed Book I art 404s on every
	// render — and the sheet re-renders on every pick.
	describe("the harvest plate", () => {
		it("is absent when the art store has not installed it", async () => {
			expect((await build().seasons.buildSnapshot()).plate).toBeNull();
		});

		it("is whatever path the art store reports", async () => {
			const { seasons } = build({ plate: "stonetop-art/steading/seasons.png" });
			expect((await seasons.buildSnapshot()).plate).toBe("stonetop-art/steading/seasons.png");
		});
	});
});
