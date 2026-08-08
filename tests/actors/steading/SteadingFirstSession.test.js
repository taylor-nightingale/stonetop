import { describe, it, expect } from "vitest";
import { SteadingFirstSession, SPRING_MOVE_SLUG } from "../../../src/actors/steading/SteadingFirstSession.js";
import { SteadingChoices } from "../../../src/actors/steading/SteadingChoices.js";
import { SEASONAL_GAINS_GROUP } from "../../../src/model/data/steading/SeasonalGains.js";
import { ChoiceTarget } from "../../../src/actors/character/ChoiceTarget.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";

function fakePcRepo(...characters) {
	return { list: () => characters };
}

function build(...characters) {
	const actor    = new FakeSteadingBuilder().build();
	const choices  = new SteadingChoices(actor);
	return { actor, choices, firstSession: new SteadingFirstSession(actor, choices, fakePcRepo(...characters)) };
}

// What the rendered pick row hands back: a "pick 1" row is radios, so every option names its
// siblings and arrives checked.
const gainTarget = (key, siblings = "population,tor,bounty,trade,news,insight") =>
	new ChoiceTarget({ context: "steading", group: SEASONAL_GAINS_GROUP, option: key, siblingsCsv: siblings });

const gainRow    = snapshot => snapshot.gains.list[0];
const pickedKeys = snapshot => gainRow(snapshot).options.filter(o => o.checked).map(o => o.slug);

describe("SteadingFirstSession", () => {
	it("names the spring move it links to", () => {
		expect(SPRING_MOVE_SLUG).toBe("seasons-change-spring");
	});

	it("reads blank on a steading that has never run session zero", () => {
		const { firstSession } = build();
		expect(firstSession.hopeful).toBe("");
		expect(firstSession.hook).toBe("");
		expect(firstSession.isDone).toBe(false);
		expect(firstSession.excitesFor("abc")).toBe("");
		expect(pickedKeys(firstSession.buildSnapshot())).toEqual([]);
	});

	it("records who the table decided is most hopeful", async () => {
		const { firstSession } = build();
		await firstSession.setHopeful("Blodwen");
		expect(firstSession.hopeful).toBe("Blodwen");
	});

	it("records the hook the roll opened", async () => {
		const { firstSession } = build();
		await firstSession.setHook("A trader from Marshedge wants an escort.");
		expect(firstSession.hook).toBe("A trader from Marshedge wants an escort.");
	});

	it("keeps earlier answers when a later one is written", async () => {
		const { firstSession } = build();
		await firstSession.setHopeful("Blodwen");
		await firstSession.setHook("Bandits on the road.");
		expect(firstSession.hopeful).toBe("Blodwen");
		expect(firstSession.hook).toBe("Bandits on the road.");
	});

	describe("what excites each player", () => {
		it("stores an answer per character", async () => {
			const { firstSession } = build();
			await firstSession.setExcites("pc1", "Finally seeing the Ruined Tower.");
			await firstSession.setExcites("pc2", "Being the one who says no.");
			expect(firstSession.excitesFor("pc1")).toBe("Finally seeing the Ruined Tower.");
			expect(firstSession.excitesFor("pc2")).toBe("Being the one who says no.");
		});

		it("ignores a write with no actor id", async () => {
			const { actor, firstSession } = build();
			await firstSession.setExcites("", "orphaned");
			expect(actor.system.firstSession).toBeUndefined();
		});
	});

	describe("done / reopen", () => {
		it("marks the first session finished", async () => {
			const { firstSession } = build();
			await firstSession.markDone();
			expect(firstSession.isDone).toBe(true);
		});

		it("reopens without losing what was recorded", async () => {
			const { firstSession, choices } = build();
			await firstSession.setHook("Bandits on the road.");
			await choices.setPickFor(gainTarget("insight"));
			await firstSession.markDone();
			await firstSession.reopen();
			expect(firstSession.isDone).toBe(false);
			expect(firstSession.hook).toBe("Bandits on the road.");
			expect(pickedKeys(firstSession.buildSnapshot())).toEqual(["insight"]);
		});
	});

	describe("buildSnapshot", () => {
		it("offers all six gains as one pick-1 row", () => {
			const row = gainRow(build().firstSession.buildSnapshot());
			expect(row.options).toHaveLength(6);
			expect(row.radio).toBe(true);
		});

		it("names the group the choice values are keyed under", () => {
			expect(build().firstSession.buildSnapshot().gains.slug).toBe(SEASONAL_GAINS_GROUP);
		});

		it("marks the picked gain", async () => {
			const { firstSession, choices } = build();
			await choices.setPickFor(gainTarget("tor"));
			expect(pickedKeys(firstSession.buildSnapshot())).toEqual(["tor"]);
		});


		it("builds one excites row per player character, carrying its stored answer", async () => {
			const { firstSession } = build({ id: "pc1", name: "Blodwen" }, { id: "pc2", name: "Vahid" });
			await firstSession.setExcites("pc2", "The Mindgem.");
			const snapshot = firstSession.buildSnapshot();
			expect(snapshot.excites.map(r => r.name)).toEqual(["Blodwen", "Vahid"]);
			expect(snapshot.excites[0].answer).toBe("");
			expect(snapshot.excites[1].answer).toBe("The Mindgem.");
		});


		it("carries whether the steading still has the spring move", () => {
			const { firstSession } = build();
			expect(firstSession.buildSnapshot(true).hasSpringMove).toBe(true);
			expect(firstSession.buildSnapshot(false).hasSpringMove).toBe(false);
			expect(firstSession.buildSnapshot().hasSpringMove).toBe(false);
		});
	});
});
