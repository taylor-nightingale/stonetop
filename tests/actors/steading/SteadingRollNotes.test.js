import { describe, it, expect } from "vitest";
import { SteadingRollNotes } from "../../../src/actors/steading/SteadingRollNotes.js";
import { SteadingImprovements } from "../../../src/actors/steading/SteadingImprovements.js";
import { SteadingDebilities } from "../../../src/actors/steading/SteadingDebilities.js";
import { SteadingImprovement } from "../../../src/actors/steading/repositories/FoundrySteadingImprovementRepository.js";
import { FakeSteadingImprovementRepository } from "../../fakes/FakeSteadingImprovementRepository.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";

// Township: advantage on three moves, outright, once the work is done.
const TOWNSHIP = () => new SteadingImprovement("township", "Township", {
	slug: "township",
	list: [{ type: "entry", slug: "government", content: { text: "a government" }, track: { max: 1 } }],
}, 0, {
	requires: "government",
	effects: [
		{ when: { kind: "completed" }, advantage: { moves: ["muster", "pull-together", "trade-barter"] },
		  text: "you have advantage to Muster, Pull Together and Trade & Barter" },
	],
});

// Stone Wall: advantage on Deploy, but only in a fiction the sheet cannot see.
const STONE_WALL = () => new SteadingImprovement("stone-wall", "Stone Wall", {
	slug: "stone-wall",
	list: [{ type: "entry", slug: "masons", content: { text: "masons" }, track: { max: 1 } }],
}, 0, {
	requires: "masons",
	effects: [
		{ when: { kind: "completed", phrase: "when **_you take advantage of the stone wall_**" },
		  advantage: { moves: ["deploy"] }, condition: true,
		  text: "you have advantage to Deploy" },
	],
});

function build({ owned = [], ticks = {}, debilities = {} } = {}) {
	const repo = new FakeSteadingImprovementRepository();
	repo._improvements.push(TOWNSHIP(), STONE_WALL());
	const actor = new FakeActorBuilder().withSystem({
		improvements: owned,
		improvementValues: ticks,
		debilities,
	}).build();
	return new SteadingRollNotes(actor, new SteadingImprovements(actor, repo), new SteadingDebilities(actor));
}

const BUILT_TOWNSHIP  = { township: { government: 1 } };
const BUILT_WALL      = { "stone-wall": { masons: 1 } };

describe("SteadingRollNotes", () => {
	it("says nothing about a steading that has built nothing", async () => {
		expect([...(await build().bySlug()).keys()]).toEqual([]);
	});

	it("reminds every move a built improvement names", async () => {
		const notes = await build({ owned: ["township"], ticks: BUILT_TOWNSHIP }).bySlug();
		expect([...notes.keys()].sort()).toEqual(["muster", "pull-together", "trade-barter"]);
		expect(notes.get("muster").all[0].source).toBe("Township");
		expect(notes.get("muster").all[0].isConditional).toBe(false);
		// Offered, never applied — advantage is the table's to take.
		expect(notes.get("muster").all[0].enforced).toBe(false);
	});

	// An unbuilt township entitles Stonetop to nothing. What it WILL be owed belongs on the
	// improvement's own card, not on the move it would apply to.
	it("says nothing for an improvement that is owned but not built", async () => {
		expect([...(await build({ owned: ["township"] }).bySlug()).keys()]).toEqual([]);
	});

	it("carries the fiction a conditional entitlement waits on", async () => {
		const notes = await build({ owned: ["stone-wall"], ticks: BUILT_WALL }).bySlug();
		expect(notes.get("deploy").all[0].clause.raw).toBe("when **_you take advantage of the stone wall_**");
	});

	// The book scopes *diminished* to three named moves. It really does flip the die (SteadingRolls
	// does that); this is the sheet finally saying so, where before it changed the roll in silence.
	it("names the debility hindering a move", async () => {
		const notes = await build({ debilities: { diminished: true } }).bySlug();
		expect([...notes.keys()].sort()).toEqual(["deploy", "muster", "pull-together"]);
		expect(notes.get("deploy").all[0].mode).toBe("dis");
		expect(notes.get("deploy").all[0].source).toBe("stonetop.steading.debilities.diminished.name");
		// The one note that is not an offer: SteadingRolls really does flip this die.
		expect(notes.get("deploy").all[0].enforced).toBe(true);
	});

	it("says nothing for a debility that is not active", async () => {
		expect([...(await build({ debilities: { diminished: false } }).bySlug()).keys()]).toEqual([]);
	});

	// Lacking and malcontent cost the steading real things, but neither is scoped to a move.
	it("says nothing for a debility that hinders no move", async () => {
		expect([...(await build({ debilities: { lacking: true, malcontent: true } }).bySlug()).keys()]).toEqual([]);
	});

	// Deploy, with the wall built and the steading diminished: both are true, and the row says both.
	it("collects an entitlement and a hindrance on the same move", async () => {
		const notes = await build({
			owned: ["stone-wall"], ticks: BUILT_WALL, debilities: { diminished: true },
		}).bySlug();
		expect(notes.get("deploy").all.map(n => n.mode).sort()).toEqual(["adv", "dis"]);
	});

	it("collects advantage on one move from two improvements", async () => {
		const notes = await build({
			owned: ["township", "stone-wall"], ticks: { ...BUILT_TOWNSHIP, ...BUILT_WALL },
		}).bySlug();
		expect(notes.get("deploy").all.map(n => n.source)).toEqual(["Stone Wall"]);
		expect(notes.get("trade-barter").all.map(n => n.source)).toEqual(["Township"]);
	});
});
