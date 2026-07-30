import { afterEach, describe, it, expect, vi } from "vitest";
import { GrantRegistry } from "../../src/item/GrantRegistry.js";
import { buildChoiceGroup } from "../../src/model/snapshot/character/buildChoiceGroup.js";
import { FakeGameBuilder } from "../fakes/FakeGameBuilder.js";
import { FakeCompendiumMoveBuilder } from "../fakes/FakeCompendiumMoveBuilder.js";
import { FakePackBuilder } from "../fakes/foundry/FakePackBuilder.js";

// A compendium follower item ({ _id, name, type, system }), shaped like FakeCompendiumMoveBuilder's output.
function followerItem(slug, name) {
	const system = { slug, hp: { value: 3, max: 3 }, tagList: null, description: `${name} desc` };
	return { _id: slug, name, type: "follower", system, toObject() { return { name, type: "follower", system }; } };
}

const moveEntry = entry(slug => ({ type: "move", slug, locations: ["inline"] }));
const followerEntry = entry(slug => ({ type: "follower", slug, locations: ["inline"] }));

function entry(grant) {
	return (rowSlug, grantSlug) => ({ type: "entry", slug: rowSlug, content: {}, grants: [grant(grantSlug)] });
}

const group = (slug, list) => buildChoiceGroup({ slug, list });

describe("GrantRegistry.fromChoiceGroups", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("resolves inline move grants into a MoveSnapshot registry", async () => {
		const clash = new FakeCompendiumMoveBuilder().withName("Clash").withDescription("**smash**").build();
		new FakeGameBuilder().withPack(FakePackBuilder.movesPack().withItem(clash)).build();

		const registry = await GrantRegistry.fromChoiceGroups([
			group("moves", [moveEntry("row", "clash"), moveEntry("miss", "not-a-real-move")]),
		]);

		expect(Object.keys(registry.moves.bySlug)).toEqual(["clash"]);
		expect(registry.moves.bySlug.clash.name).toBe("Clash");
		expect(registry.moves.bySlug.clash.description.raw).toBe("**smash**");
	});

	it("resolves inline follower grants (compendium + world) into a FollowersSnapshot registry", async () => {
		new FakeGameBuilder()
			.withPack(new FakePackBuilder("followers").withItem(followerItem("the-ring", "The Ring")))
			.withWorldItem(followerItem("homebrew", "Homebrew Pal"))
			.build();

		const registry = await GrantRegistry.fromChoiceGroups([
			group("bound", [followerEntry("r", "the-ring"), followerEntry("h", "homebrew")]),
		]);

		expect(registry.followers.get("the-ring").name).toBe("The Ring");
		expect(registry.followers.get("homebrew").name).toBe("Homebrew Pal");
	});

	it("returns an empty registry without touching the repositories when nothing is granted", async () => {
		const moveRepo = { getMoveEntriesBySlugs: vi.fn() };
		const followerRepo = { getFollowerDocsBySlugs: vi.fn() };

		const registry = await GrantRegistry.fromChoiceGroups(
			[group("g", [{ type: "entry", slug: "plain", content: {} }])],
			{ moveRepo, followerRepo },
		);

		expect(registry.moves.bySlug).toEqual({});
		expect(registry.followers.bySlug).toEqual({});
		expect(moveRepo.getMoveEntriesBySlugs).not.toHaveBeenCalled();
		expect(followerRepo.getFollowerDocsBySlugs).not.toHaveBeenCalled();
	});
});
