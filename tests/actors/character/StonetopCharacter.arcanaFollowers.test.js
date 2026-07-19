import {describe, it, expect, afterEach, vi} from "vitest";
import {StonetopCharacter} from "../../../src/actors/character/StonetopCharacter.js";
import {FoundryRepositoryFactory} from "../../../src/actors/character/repositories/FoundryRepositoryFactory.js";
import {FakeGameBuilder} from "../../fakes/FakeGameBuilder.js";
import {FakeCharacterActorBuilder} from "../../fakes/FakeCharacterActorBuilder.js";
import {FakePackBuilder} from "../../fakes/foundry/FakePackBuilder.js";

// Integration test: real StonetopCharacter + real FoundryRepositoryFactory + real CharacterArcana/
// CharacterFollowers + real ChoiceGroupFactory/Controller + real FollowerSideEffectHandler. Only the
// Foundry boundary (game.packs / embedded documents) is faked. This drives the exact wiring a sheet
// click takes — setArcanumChoiceCount → generic choiceValues controller → side-effect handler → addFollower
// — proving that ticking a follower's back-choice box actually embeds the follower on the sheet.
//
// This is the seam the mocked unit tests couldn't see: the bug (blackwood/mindgem shipped
// back.choices.slug "followers" ≠ the arcanum slug the group is namespaced by, so the side-effect def
// lookup silently returned null and the follower was never added) only shows up when the real
// controller resolves the real definition from the real (pack-shaped) item data.

function followerDoc(slug, arcanaSlug) {
	return {
		_id: `${slug}-f`, name: slug.replace(/-/g, " "),
		system: {
			slug, arcanaSlug, hp: { value: 6, max: 6 }, armor: "", damage: "",
			instinct: "", loyalty: { value: 0, max: 3 }, choices: null,
		},
	};
}

// A dropped follower arcanum (blackwood-shaped). Its back choice group is namespaced by the arcanum
// slug — the invariant the whole arcana pipeline relies on — and carries a follower entry row.
function followerArcanumItem() {
	return {
		_id: "arc1", type: "arcanum", name: "Mysteries of the Blackwood", major: true,
		system: {
			slug: "blackwood-fetishes", major: true, flipped: true,
			front: { title: "Blackwood fetishes", description: null, item: null, unlock: null },
			back: {
				title: "The fetishes", description: "the back",
				choices: {
					slug: "blackwood-fetishes",
					list: [
						{ type: "entry", slug: "astor", followers: { slugs: ["astor"], inlineDisplay: true },
							content: { title: null, text: "" }, track: { max: 1 } },
					],
				},
			},
			choiceValues: {},
		},
	};
}

function characterWithFollowerArcanum() {
	new FakeGameBuilder()
		.withPack(new FakePackBuilder("followers").withItem(followerDoc("astor", "blackwood-fetishes")))
		.withPack(FakePackBuilder.movesPack())
		.build();
	const arcanum = followerArcanumItem();
	const character = new StonetopCharacter(
		new FakeCharacterActorBuilder().addItem(arcanum).build(), new FoundryRepositoryFactory(),
	);
	return { character, arcanum };
}

async function ownedFollowerSlugs(character) {
	const snap = await character.buildSnapshot();
	return snap.followers.map(f => f.slug);
}

describe("StonetopCharacter — arcanum follower checkboxes (integration)", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("dropping the arcanum does NOT embed its follower", async () => {
		const { character, arcanum } = characterWithFollowerArcanum();
		await character._onCreateDescendantDocuments([arcanum]);
		expect(await ownedFollowerSlugs(character)).not.toContain("astor");
	});

	it("checking the follower's back-choice box embeds the follower", async () => {
		const { character, arcanum } = characterWithFollowerArcanum();
		await character._onCreateDescendantDocuments([arcanum]);

		await character.setArcanumChoiceCount("blackwood-fetishes", "blackwood-fetishes", "astor", 1);

		expect(await ownedFollowerSlugs(character)).toContain("astor");
	});

	it("unchecking the box removes the follower again", async () => {
		const { character, arcanum } = characterWithFollowerArcanum();
		await character._onCreateDescendantDocuments([arcanum]);
		await character.setArcanumChoiceCount("blackwood-fetishes", "blackwood-fetishes", "astor", 1);

		await character.setArcanumChoiceCount("blackwood-fetishes", "blackwood-fetishes", "astor", 0);

		expect(await ownedFollowerSlugs(character)).not.toContain("astor");
	});

	it("deleting the arcanum removes a follower that was checked", async () => {
		const { character, arcanum } = characterWithFollowerArcanum();
		await character._onCreateDescendantDocuments([arcanum]);
		await character.setArcanumChoiceCount("blackwood-fetishes", "blackwood-fetishes", "astor", 1);

		await character.removeArcanum("blackwood-fetishes");

		expect(await ownedFollowerSlugs(character)).not.toContain("astor");
	});
});
