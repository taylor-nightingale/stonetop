import { describe, it, expect, afterEach, vi } from "vitest";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FoundryRepositoryFactory } from "../../../src/actors/character/repositories/FoundryRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakePackBuilder } from "../../fakes/foundry/FakePackBuilder.js";

// Integration test: real StonetopCharacter + real CharacterPossessions + real CharacterFollowers +
// real FoundryFollowerRepository. Only the Foundry boundary (game.packs, embedded documents) is faked.
// Ticking a possession that grants a follower — the Ranger's Hounds, the Would-Be Hero's good dog —
// puts that follower on the Followers tab; unticking takes it off without losing it.

const member = () => ({ name: "", hp: { value: 6, max: 6 } });

function houndsFollowerDoc() {
	return {
		_id: "hounds-f", name: "Hounds",
		system: {
			slug: "hounds", tagList: ["group", "alert"], hp: { value: 6, max: 6 },
			damage: "d6", loyalty: { value: 0, max: 3 }, members: [member(), member(), member()],
		},
	};
}

function goodDogFollowerDoc() {
	return {
		_id: "dog-f", name: "A good dog",
		system: { slug: "a-good-dog", tagList: ["keen-nosed"], hp: { value: 6, max: 6 }, damage: "d6", loyalty: { value: 0, max: 3 } },
	};
}

function possessionItem(slug, name) {
	return {
		_id: `${slug}-p`, type: "possession", name,
		flags: { stonetop: { grant: { source: "playbook:the-ranger", key: `possession:${slug}` } } },
		system: {
			slug, description: "", outfitItems: [], choices: null, selected: false, preselected: false,
			uses: 0, pickValues: {}, choiceUses: {},
			grants: [{ type: "follower", slug, locations: ["tab"] }],
		},
	};
}

function makeCharacter(...possessions) {
	new FakeGameBuilder()
		.withPack(new FakePackBuilder("followers").withItem(houndsFollowerDoc()).withItem(goodDogFollowerDoc()))
		.withPack(new FakePackBuilder("outfit-items"))
		.withPack(new FakePackBuilder("possessions"))
		.withPack(FakePackBuilder.movesPack())
		.withPack(FakePackBuilder.playbooksPack())
		.build();
	const builder = new FakeCharacterActorBuilder();
	for (const p of possessions) builder.addItem(p);
	const actor = builder.build();
	return { character: new StonetopCharacter(actor, new FoundryRepositoryFactory()), actor };
}

const followerItem = (actor, slug) => [...actor.items].find(i => i.type === "follower" && i.system?.slug === slug);

describe("possession → follower (integration)", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("ticking Hounds puts a three-strong group follower on the Followers tab", async () => {
		const { character, actor } = makeCharacter(possessionItem("hounds", "Hounds"));

		await character.selectPossession("hounds");

		const hounds = followerItem(actor, "hounds");
		expect(hounds.system.tagList).toContain("group");
		expect(hounds.system.members).toHaveLength(3);
		expect((await character.buildSnapshot()).followers.tab).toContain("hounds");
	});

	it("ticking A good dog puts a single follower on the Followers tab", async () => {
		const { character, actor } = makeCharacter(possessionItem("a-good-dog", "A good dog"));

		await character.selectPossession("a-good-dog");

		expect(followerItem(actor, "a-good-dog").system.members).toEqual([]);
		expect((await character.buildSnapshot()).followers.tab).toContain("a-good-dog");
	});

	it("unticking takes the follower off the tab but keeps what the player wrote on it", async () => {
		const { character, actor } = makeCharacter(possessionItem("hounds", "Hounds"));
		await character.selectPossession("hounds");
		await actor.updateEmbeddedDocuments("Item", [{ _id: followerItem(actor, "hounds")._id, system: { loyalty: { value: 2, max: 3 } } }]);

		await character.deselectPossession("hounds");

		expect(followerItem(actor, "hounds").system.loyalty.value).toBe(2);
		expect((await character.buildSnapshot()).followers.tab).not.toContain("hounds");
	});
});
