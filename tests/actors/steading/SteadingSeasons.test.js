import { describe, it, expect } from "vitest";
import { SteadingSeasons } from "../../../src/actors/steading/SteadingSeasons.js";
import { SteadingChoices } from "../../../src/actors/steading/SteadingChoices.js";
import { SteadingMoves } from "../../../src/actors/steading/SteadingMoves.js";
import { Seasons } from "../../../src/model/data/steading/Seasons.js";
import { SEASONAL_GAINS_GROUP } from "../../../src/model/data/steading/SeasonalGains.js";
import { ChoiceTarget } from "../../../src/actors/character/ChoiceTarget.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../../fakes/FakeCompendiumMoveBuilder.js";
import { FakeSteadingArtRepository, steadingRepos } from "../../fakes/FakeSteadingRepos.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";

const seasonMove = name =>
	new FakeCompendiumMoveBuilder().withName(name).withMoveType("seasons").build();

// A real SteadingMoves behind it: SteadingSeasons asks for its own category by key, so a fake that
// just handed back a category would prove nothing about that wiring.
function build({ moveNames = [], plate = null } = {}) {
	const actor = new FakeSteadingBuilder().build();
	const repo  = new FakeMoveRepository();
	moveNames.forEach(n => repo.addBasic(seasonMove(n)));
	const choices = new SteadingChoices(actor);
	const moves   = new SteadingMoves(actor, repo);
	const seasons = new SteadingSeasons(choices, moves, new FakeSteadingArtRepository(plate));
	// Picks are made the way the sheet makes them — through the steading — so the store this reads
	// back from is genuinely the one the registry routes to.
	const steading = new StonetopSteading(actor, steadingRepos({ moves: repo }));
	return { actor, choices, moves, seasons, steading };
}

const allFour = () => Seasons.all().map(s => `Seasons Change: ${s.label}`);

const gainTarget = key => new ChoiceTarget({
	context: "steading", group: SEASONAL_GAINS_GROUP, option: key,
	siblingsCsv: "population,tor,bounty,trade,news,insight",
});
const picked = snapshot => snapshot.gains.list[0].options.filter(o => o.checked).map(o => o.slug);

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

	it("drops a season whose move the steading no longer carries", async () => {
		const { seasons, moves } = build({ moveNames: ["Seasons Change: Spring"] });
		await moves.seedReferenceMoves();
		expect((await seasons.buildSnapshot()).moves.moves).toHaveLength(1);
	});

	it("has no move category at all when the steading carries none of them", async () => {
		expect((await build().seasons.buildSnapshot()).moves).toBeNull();
	});

	describe("seasonal gains", () => {
		it("offers all six as one pick-1 row", async () => {
			const row = (await build().seasons.buildSnapshot()).gains.list[0];
			expect(row.options).toHaveLength(6);
			expect(row.radio).toBe(true);
		});

		it("marks the pick stored in the steading's choice values", async () => {
			const { seasons, steading } = build();
			await steading.setChoicePickFor(gainTarget("tor"), true);
			expect(picked(await seasons.buildSnapshot())).toEqual(["tor"]);
		});

		it("replaces the previous pick rather than accumulating", async () => {
			const { seasons, steading } = build();
			await steading.setChoicePickFor(gainTarget("tor"), true);
			await steading.setChoicePickFor(gainTarget("news"), true);
			expect(picked(await seasons.buildSnapshot())).toEqual(["news"]);
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
