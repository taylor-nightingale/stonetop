import { describe, it, expect } from "vitest";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { SteadingImprovement } from "../../../src/actors/steading/repositories/FoundrySteadingImprovementRepository.js";
import { FakeSteadingImprovementRepository } from "../../fakes/FakeSteadingImprovementRepository.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";

// End-to-end for the roll reminder: real StonetopSteading + SteadingRollNotes + SteadingImprovements +
// SteadingMoves, only the Foundry boundary faked. The reminder is composed from two collaborators that
// know nothing about each other and reaches the row through three more, so the wiring is the part most
// likely to break — a unit test of each piece would pass with the notes never handed over at all.

// Township as the pack now carries it: advantage on three moves, outright, once the work is done.
const TOWNSHIP = () => new SteadingImprovement("township", "Township", {
	slug: "township",
	list: [{ type: "entry", slug: "government", content: { text: "a formal government" }, track: { max: 1 } }],
}, 0, {
	requires: "government",
	effects: [
		{ when: { kind: "completed" }, advantage: { moves: ["muster", "pull-together", "trade-barter"] },
		  text: "you have advantage to Muster, Pull Together and Trade & Barter" },
	],
});

// Stone Wall's Deploy clause, which waits on fiction the sheet cannot see.
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

const HOMEFRONT = [
	{ slug: "muster",       name: "Muster",         rollStat: "population" },
	{ slug: "pull-together", name: "Pull Together", rollStat: "population" },
	{ slug: "trade-barter", name: "Trade & Barter", rollStat: "prosperity" },
	{ slug: "deploy",       name: "Deploy",         rollStat: "defenses" },
	{ slug: "bolster",      name: "Bolster",        rollStat: "fortunes" },
];

function makeSteading({ ticks = {}, debilities = {} } = {}) {
	const catalog = new FakeSteadingImprovementRepository();
	catalog._improvements.push(TOWNSHIP(), STONE_WALL());
	const actor = new FakeSteadingBuilder()
		.withTypedActor(a => new StonetopSteading(a,
			steadingRepos({ improvements: catalog, moves: new FakeMoveRepository() })))
		.build();
	actor.system.improvements = ["township", "stone-wall"];
	actor.system.improvementValues = ticks;
	actor.system.debilities = { diminished: false, lacking: false, malcontent: false, ...debilities };
	// The steading's own moves, as the reference seed leaves them: owned items filed by category.
	actor.items.push(...HOMEFRONT.map((move, i) => ({
		_id: `move-${i}`, type: "move", name: move.name,
		system: { slug: move.slug, categoryKey: "homefront", rollStat: move.rollStat, description: "" },
	})));
	actor.items.get = id => actor.items.find(i => i._id === id) ?? null;
	return actor.typedActor;
}

const rowFor = (snapshot, slug) => snapshot.homefrontMoves.moves.find(m => m.slug === slug);

const BUILT_TOWNSHIP = { township: { government: 1 } };
const BUILT_WALL     = { "stone-wall": { masons: 1 } };

describe("the roll reminder reaches the rail", () => {
	it("carries no reminder on a steading that has built nothing", async () => {
		const snapshot = await makeSteading().buildSnapshot();
		expect(rowFor(snapshot, "muster").rollNotes).toBeNull();
		expect(rowFor(snapshot, "deploy").rollNotes).toBeNull();
	});

	it("reminds the rows a built improvement names, and only those", async () => {
		const snapshot = await makeSteading({ ticks: BUILT_TOWNSHIP }).buildSnapshot();
		for (const slug of ["muster", "pull-together", "trade-barter"]) {
			const notes = rowFor(snapshot, slug).rollNotes.all;
			expect(notes.map(n => n.source)).toEqual(["Township"]);
			// Offered, never applied — which is what the line has to say, or it reads as a state.
			expect(notes[0].verdictKey).toBe("stonetop.steading.rollNote.canApply");
		}
		expect(rowFor(snapshot, "bolster").rollNotes).toBeNull();
		expect(rowFor(snapshot, "deploy").rollNotes).toBeNull();
	});

	it("names the improvement the reminder came from", async () => {
		const snapshot = await makeSteading({ ticks: BUILT_TOWNSHIP }).buildSnapshot();
		expect(rowFor(snapshot, "muster").rollNotes.all.map(n => n.source)).toEqual(["Township"]);
	});

	it("carries the fiction a conditional entitlement waits on", async () => {
		const notes = rowFor(await makeSteading({ ticks: BUILT_WALL }).buildSnapshot(), "deploy").rollNotes;
		expect(notes.all[0].source).toBe("Stone Wall");
		expect(notes.all[0].clause.raw).toBe("when **_you take advantage of the stone wall_**");
	});

	// Deploy, with the wall built and the steading diminished. *diminished* really does flip the die —
	// SteadingRolls does that — and this is the first thing on the sheet that says so.
	it("states an entitlement and a hindrance on the same row", async () => {
		const snapshot = await makeSteading({
			ticks: BUILT_WALL, debilities: { diminished: true },
		}).buildSnapshot();
		const notes = rowFor(snapshot, "deploy").rollNotes.all;
		expect(notes.map(n => n.source)).toEqual(["Stone Wall", "stonetop.steading.debilities.diminished.name"]);
		// The wall OFFERS; the debility already applies. Not symmetrical, because the rules are not.
		expect(notes.map(n => n.verdictKey)).toEqual([
			"stonetop.steading.rollNote.canApply",
			"stonetop.steading.rollNote.applies",
		]);
	});

	// Owned but unbuilt entitles the steading to nothing: the promise belongs on the improvement's card.
	it("says nothing for an improvement whose work is not done", async () => {
		const snapshot = await makeSteading().buildSnapshot();
		expect(rowFor(snapshot, "trade-barter").rollNotes).toBeNull();
	});
});
