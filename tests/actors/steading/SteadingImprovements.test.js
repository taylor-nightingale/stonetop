import { describe, it, expect } from "vitest";
import { SteadingImprovements } from "../../../src/actors/steading/SteadingImprovements.js";
import { SteadingImprovement } from "../../../src/actors/steading/repositories/FoundrySteadingImprovementRepository.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";

// The repo now resolves a single slug → its content; the steading renders only the improvements it
// OWNS (system.improvements), with pick state in system.improvementValues.
function makeRepo(improvements = []) {
	return {
		getBySlug: async (slug) => improvements.find(i => i.slug === slug) ?? null,
	};
}

function makeActor(improvements = []) {
	return new FakeActorBuilder().withSystem({ improvements, improvementValues: {} }).build();
}

const PALISADE_CHOICES = {
	slug: "palisade",
	list: [{ type: "heading", slug: "done", description: "Completed", track: { max: 1 } }],
};

const palisadeRepo = () => makeRepo([new SteadingImprovement("palisade", PALISADE_CHOICES)]);

describe("SteadingImprovements.buildSnapshot", () => {
	it("returns empty when the steading owns no improvements", async () => {
		const imp = new SteadingImprovements(makeActor([]), palisadeRepo());
		expect(await imp.buildSnapshot()).toEqual([]);
	});

	it("renders only the improvements the steading owns, resolved by slug", async () => {
		const repo = makeRepo([
			new SteadingImprovement("inn", { slug: "inn", list: [] }),
			new SteadingImprovement("palisade", PALISADE_CHOICES),
		]);
		const imp = new SteadingImprovements(makeActor(["palisade"]), repo);
		const snap = await imp.buildSnapshot();
		expect(snap).toHaveLength(1);
		expect(snap[0].slug).toBe("palisade");
	});

	it("skips an owned slug the repo can't resolve or whose choices are null", async () => {
		const repo = makeRepo([new SteadingImprovement("mill", null)]);
		const imp = new SteadingImprovements(makeActor(["mill", "ghost"]), repo);
		expect(await imp.buildSnapshot()).toEqual([]);
	});

	it("track is unchecked by default", async () => {
		const imp = new SteadingImprovements(makeActor(["palisade"]), palisadeRepo());
		const snap = await imp.buildSnapshot();
		expect(snap[0].list[0].track.checks[0]).toBe(false);
	});
});

describe("SteadingImprovements.setTrack", () => {
	it("checking a track is reflected in the snapshot", async () => {
		const imp = new SteadingImprovements(makeActor(["palisade"]), palisadeRepo());
		await imp.setTrack("palisade", "done", 1);
		const snap = await imp.buildSnapshot();
		expect(snap[0].list[0].track.checks[0]).toBe(true);
	});

	it("clearing a track sets it back to unchecked", async () => {
		const imp = new SteadingImprovements(makeActor(["palisade"]), palisadeRepo());
		await imp.setTrack("palisade", "done", 1);
		await imp.setTrack("palisade", "done", 0);
		const snap = await imp.buildSnapshot();
		expect(snap[0].list[0].track.checks[0]).toBe(false);
	});
});

describe("SteadingImprovements.toggleTrack", () => {
	it("checking pip 0 fills the track to 1", async () => {
		const imp = new SteadingImprovements(makeActor(["palisade"]), palisadeRepo());
		await imp.toggleTrack("palisade", "done", "0", true);
		const snap = await imp.buildSnapshot();
		expect(snap[0].list[0].track.checks[0]).toBe(true);
	});

	it("unchecking pip 0 empties the track", async () => {
		const imp = new SteadingImprovements(makeActor(["palisade"]), palisadeRepo());
		await imp.toggleTrack("palisade", "done", "0", true);
		await imp.toggleTrack("palisade", "done", "0", false);
		const snap = await imp.buildSnapshot();
		expect(snap[0].list[0].track.checks[0]).toBe(false);
	});
});
