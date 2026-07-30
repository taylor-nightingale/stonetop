import { afterEach, describe, it, expect, vi } from "vitest";
import { FoundryFollowerRepository } from "../../../../src/actors/character/repositories/FoundryFollowerRepository.js";
import { FakeGameBuilder } from "../../../fakes/FakeGameBuilder.js";
import { FakePackBuilder } from "../../../fakes/foundry/FakePackBuilder.js";

// A follower item ({ _id, name, type, system }) shaped like a real Foundry item, with a world-safe toObject.
function followerItem(slug, name) {
	const system = { slug, hp: { value: 3, max: 3 } };
	return { _id: slug, name, type: "follower", system, toObject() { return { name, type: "follower", system }; } };
}

describe("FoundryFollowerRepository.getFollowerDocsBySlugs", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("returns [] for an empty list", async () => {
		new FakeGameBuilder().build();
		expect(await new FoundryFollowerRepository().getFollowerDocsBySlugs([])).toEqual([]);
	});

	it("returns item-shaped follower docs across compendium + world, in order, dropping unknowns", async () => {
		new FakeGameBuilder()
			.withPack(new FakePackBuilder("followers").withItem(followerItem("the-ring", "The Ring")))
			.withWorldItem(followerItem("homebrew", "Homebrew Pal"))
			.build();

		const docs = await new FoundryFollowerRepository()
			.getFollowerDocsBySlugs(["homebrew", "nope", "the-ring"]);

		expect(docs.map(d => d.name)).toEqual(["Homebrew Pal", "The Ring"]);
		expect(docs.every(d => d.system?.slug)).toBe(true);
	});
});
