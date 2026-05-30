import { describe, it, expect } from "vitest";
import { SteadingImprovements } from "../../../module/actors/steading/SteadingImprovements.js";
import { SteadingImprovement } from "../../../module/actors/steading/repositories/FoundrySteadingImprovementRepository.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";

function makeRepo(improvements = []) {
	return {getAll: async () => improvements};
}

const PALISADE_CHOICES = {
	slug: "palisade",
	list: [{ type: "heading", slug: "done", description: "Completed", track: { max: 1 } }],
};

function makePalisadeRepo() {
	return makeRepo([new SteadingImprovement("palisade", PALISADE_CHOICES)]);
}

describe("SteadingImprovements.buildSnapshot", () => {
	it("returns empty array when repo is empty", async () => {
		const imp = new SteadingImprovements(new FakeActorBuilder().build(), makeRepo());
		expect(await imp.buildSnapshot()).toEqual([]);
	});

	it("filters out improvements with null choices", async () => {
		const repo = makeRepo([
			new SteadingImprovement("inn", {slug: "inn", list: []}),
			new SteadingImprovement("mill", null),
		]);
		const imp = new SteadingImprovements(new FakeActorBuilder().build(), repo);
		const snap = await imp.buildSnapshot();
		expect(snap).toHaveLength(1);
		expect(snap[0].slug).toBe("inn");
	});

	it("builds ChoiceGroup from improvement choices", async () => {
		const imp = new SteadingImprovements(new FakeActorBuilder().build(), makePalisadeRepo());
		const snap = await imp.buildSnapshot();
		expect(snap[0].slug).toBe("palisade");
	});

	it("track is unchecked by default", async () => {
		const imp = new SteadingImprovements(new FakeActorBuilder().build(), makePalisadeRepo());
		const snap = await imp.buildSnapshot();
		expect(snap[0].list[0].track.checks[0]).toBe(false);
	});
});

describe("SteadingImprovements.setTrack", () => {
	it("checking a track is reflected in the snapshot", async () => {
		const imp = new SteadingImprovements(new FakeActorBuilder().build(), makePalisadeRepo());
		await imp.setTrack("palisade", "done", 1);
		const snap = await imp.buildSnapshot();
		expect(snap[0].list[0].track.checks[0]).toBe(true);
	});

	it("clearing a track sets it back to unchecked", async () => {
		const imp = new SteadingImprovements(new FakeActorBuilder().build(), makePalisadeRepo());
		await imp.setTrack("palisade", "done", 1);
		await imp.setTrack("palisade", "done", 0);
		const snap = await imp.buildSnapshot();
		expect(snap[0].list[0].track.checks[0]).toBe(false);
	});
});
