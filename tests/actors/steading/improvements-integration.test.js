import { describe, it, expect, vi, afterEach } from "vitest";
import { SteadingImprovements } from "../../../src/actors/steading/SteadingImprovements.js";
import { FoundrySteadingImprovementRepository } from "../../../src/actors/steading/repositories/FoundrySteadingImprovementRepository.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";
import { ChoiceTarget } from "../../../src/actors/character/ChoiceTarget.js";

// End-to-end: the REAL improvement repository (compendium + world) resolving a steading's OWNED slugs
// through the REAL SteadingImprovements snapshot builder (real buildChoiceGroup). Only the
// Foundry game boundary (packs + items) is mocked — proving a custom world improvement the steading
// owns actually surfaces on it.

function packEntry(slug, sortOrder, choices) {
	return { _id: `pack-${slug}`, name: slug, type: "improvement", system: { slug, sortOrder, choices } };
}

function worldEntry(slug, sortOrder, choices) {
	const obj = { _id: `world-${slug}`, name: slug, type: "improvement", system: { slug, sortOrder, choices } };
	return { type: "improvement", toObject: () => obj };
}

// The steading-improvements pack holds the pack entries; any other pack name resolves to an empty stub.
function stubGame(packEntries, worldEntries) {
	const pack = { getIndex: async () => {}, index: packEntries, folders: [] };
	const empty = { getIndex: async () => {}, index: [], folders: [] };
	vi.stubGlobal("game", {
		packs: { get: (name) => name === "stonetop.steading-improvements" ? pack : empty },
		items: { contents: worldEntries },
	});
}

// Track writes go through the steading, the way the sheet makes them: its registry resolves the
// `improvement` context to this improvement's own controller.
const watchtowerTrack = () =>
	new ChoiceTarget({ context: "improvement", group: "watchtower", option: "built" });

const steadingOver = actor =>
	new StonetopSteading(actor, steadingRepos({ improvements: new FoundrySteadingImprovementRepository() }));

// A steading owns a slug list (system.improvements) and keeps pick state in system.improvementValues.
function makeActor(improvements = [], improvementValues = {}) {
	return { system: { improvements, improvementValues }, update: vi.fn(async () => {}) };
}

const WATCHTOWER = {
	slug: "watchtower",
	list: [{ type: "entry", slug: "built", content: { title: "Watchtower", text: "Keep the watch." }, track: { max: 2 } }],
};

describe("Steading improvements — custom world improvement (integration)", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("surfaces an owned world-authored improvement in the snapshot, in owned order", async () => {
		stubGame(
			[packEntry("inn", 1, { slug: "inn", list: [] })],
			[worldEntry("watchtower", 2, WATCHTOWER)],
		);
		const improvements = new SteadingImprovements(makeActor(["inn", "watchtower"]), new FoundrySteadingImprovementRepository());
		const snap = await improvements.buildSnapshot();

		expect(snap.map(g => g.slug)).toEqual(["inn", "watchtower"]);
		expect(snap[1].list[0].track.checks).toEqual([false, false]);
	});

	it("does not surface improvements the steading does not own", async () => {
		stubGame([packEntry("inn", 1, { slug: "inn", list: [] })], [worldEntry("watchtower", 2, WATCHTOWER)]);
		const improvements = new SteadingImprovements(makeActor(["watchtower"]), new FoundrySteadingImprovementRepository());
		const snap = await improvements.buildSnapshot();
		expect(snap.map(g => g.slug)).toEqual(["watchtower"]);
	});

	it("reflects a stored track value on the custom improvement's group", async () => {
		stubGame([], [worldEntry("watchtower", 1, WATCHTOWER)]);
		const actor = makeActor(["watchtower"], { watchtower: { built: 1 } });
		const improvements = new SteadingImprovements(actor, new FoundrySteadingImprovementRepository());
		const snap = await improvements.buildSnapshot();

		expect(snap[0].list[0].track.checks).toEqual([true, false]);
	});

	// The drop path end to end against the REAL catalog: a wonder improvement that exists only in the
	// pack is granted by slug and immediately resolves to its content — the proof that a dropped
	// improvement needs no embedded item to show up on the sheet.
	it("renders an improvement granted by slug, resolved through the real catalog", async () => {
		stubGame([packEntry("watchtower", 1, WATCHTOWER)], []);
		const actor = new FakeActorBuilder().withSystem({ improvements: [], improvementValues: {} }).build();
		const improvements = new SteadingImprovements(actor, new FoundrySteadingImprovementRepository());

		await improvements.grant("watchtower");
		const snap = await improvements.buildSnapshot();

		expect(actor.system.improvements).toEqual(["watchtower"]);
		expect(snap.map(g => g.slug)).toEqual(["watchtower"]);
		expect(snap[0].list[0].content.title.raw).toBe("Watchtower");
	});

	it("track state set after a grant survives a revoke and re-grant", async () => {
		stubGame([packEntry("watchtower", 1, WATCHTOWER)], []);
		const actor = new FakeActorBuilder().withSystem({ improvements: [], improvementValues: {} }).build();
		const improvements = new SteadingImprovements(actor, new FoundrySteadingImprovementRepository());

		await improvements.grant("watchtower");
		await steadingOver(actor).setChoiceTrackFor(watchtowerTrack(), "0", true);
		await improvements.revoke("watchtower");
		await improvements.grant("watchtower");

		const snap = await improvements.buildSnapshot();
		expect(snap[0].list[0].track.checks).toEqual([true, false]);
	});

	it("writes a track change back for a custom improvement", async () => {
		stubGame([], [worldEntry("watchtower", 1, WATCHTOWER)]);
		const actor = makeActor(["watchtower"]);
		await steadingOver(actor).setChoiceTrackFor(watchtowerTrack(), "1", true);

		expect(actor.update).toHaveBeenCalledWith({
			"system.improvementValues": { watchtower: { built: 2 } },
		});
	});
});
