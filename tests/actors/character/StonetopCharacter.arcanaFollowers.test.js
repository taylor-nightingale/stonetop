import {describe, it, expect, afterEach, vi} from "vitest";
import { ChoiceTarget } from "../../../src/actors/character/ChoiceTarget.js";
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

function followerDoc(slug, arcanaSlug, extraSystem = {}) {
	return {
		_id: `${slug}-f`, name: slug.replace(/-/g, " "),
		system: {
			slug, arcanaSlug, hp: { value: 6, max: 6 }, armor: "", damage: "",
			instinct: "", loyalty: { value: 0, max: 3 }, choices: null, ...extraSystem,
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

// The Followers TAB slug list — the normalized snapshot's `followers.tab` (owned followers their
// granting authority placed on the tab). A choice-gated follower like astor is showOnTab by default.
async function tabFollowerSlugs(character) {
	const snap = await character.buildSnapshot();
	return snap.followers.tab;
}

describe("StonetopCharacter — arcanum follower checkboxes (integration)", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("dropping the arcanum does NOT embed its follower", async () => {
		const { character, arcanum } = characterWithFollowerArcanum();
		await character._onCreateDescendantDocuments([arcanum]);
		expect(await tabFollowerSlugs(character)).not.toContain("astor");
	});

	it("checking the follower's back-choice box embeds the follower", async () => {
		const { character, arcanum } = characterWithFollowerArcanum();
		await character._onCreateDescendantDocuments([arcanum]);

		await character.setChoiceCountFor(new ChoiceTarget({ context: "arcana", arcanumSlug: "blackwood-fetishes", group: "blackwood-fetishes", option: "astor" }), 1);

		expect(await tabFollowerSlugs(character)).toContain("astor");
	});

	it("unchecking the box removes the follower again", async () => {
		const { character, arcanum } = characterWithFollowerArcanum();
		await character._onCreateDescendantDocuments([arcanum]);
		await character.setChoiceCountFor(new ChoiceTarget({ context: "arcana", arcanumSlug: "blackwood-fetishes", group: "blackwood-fetishes", option: "astor" }), 1);

		await character.setChoiceCountFor(new ChoiceTarget({ context: "arcana", arcanumSlug: "blackwood-fetishes", group: "blackwood-fetishes", option: "astor" }), 0);

		expect(await tabFollowerSlugs(character)).not.toContain("astor");
	});

	it("deleting the arcanum removes a follower that was checked", async () => {
		const { character, arcanum } = characterWithFollowerArcanum();
		await character._onCreateDescendantDocuments([arcanum]);
		await character.setChoiceCountFor(new ChoiceTarget({ context: "arcana", arcanumSlug: "blackwood-fetishes", group: "blackwood-fetishes", option: "astor" }), 1);

		await character.removeArcanum("blackwood-fetishes");

		expect(await tabFollowerSlugs(character)).not.toContain("astor");
	});
});

// The Ring of Daagon prints an OBJECT follower on the card FRONT (front.unlock) — no checkbox (no
// track), so its arcanum grants it owned-by-default, and the link's hideFromFollowersTab stamps it
// card-only. This locks: (1) the front card references + resolves the follower, (2) it's owned/stateful
// but off the tab, (3) it renders as an object (no HP). Drives the real character.buildSnapshot().
function ringArcanumItem() {
	return {
		_id: "ring", type: "arcanum", name: "Ring of Daagon", major: true,
		system: {
			slug: "ring-of-daagon", major: true, flipped: false,
			front: {
				title: "Ring of Daagon", description: null, item: null,
				unlock: {
					slug: "ring-of-daagon",
					list: [
						// No `track`: owned-by-default grant, not a choice-gated checkbox.
						{ type: "entry", slug: "the-ring", content: { title: null, text: "" },
							followers: { slugs: ["the-ring"], inlineDisplay: true, hideFromFollowersTab: true } },
					],
				},
			},
			back: { title: "The Ring", description: "the back", choices: null },
			choiceValues: {},
		},
	};
}

function characterWithRing() {
	new FakeGameBuilder()
		.withPack(new FakePackBuilder("followers").withItem(followerDoc("the-ring", "ring-of-daagon", { kind: "object" })))
		.withPack(FakePackBuilder.movesPack())
		.build();
	const arcanum = ringArcanumItem();
	const actor = new FakeCharacterActorBuilder().addItem(arcanum).build();
	const character = new StonetopCharacter(actor, new FoundryRepositoryFactory());
	return { character, actor, arcanum };
}

// Find the embedded follower item on the actor (the owned-by-default grant).
function followerItem(actor, slug) {
	return [...actor.items].find(i => i.type === "follower" && i.system?.slug === slug) ?? null;
}

describe("StonetopCharacter — arcanum front-unlock object follower (integration)", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("grants the Ring owned-by-default on arcanum-add, stamped off the tab", async () => {
		const { character, actor, arcanum } = characterWithRing();
		await character._onCreateDescendantDocuments([arcanum]);
		const ring = followerItem(actor, "the-ring");
		expect(ring?.system?.owned).toBe(true);       // owned → stores loyalty/edits
		expect(ring?.system?.showOnTab).toBe(false);  // its granting authority placed it card-only
	});

	it("references the follower on the card FRONT and resolves it via the registry, as an object", async () => {
		const { character, arcanum } = characterWithRing();
		await character._onCreateDescendantDocuments([arcanum]);
		const snap = await character.buildSnapshot();
		const card = snap.arcana.major.items.find(a => a.slug === "ring-of-daagon");
		const row  = card.front.unlock.list.find(r => r.slug === "the-ring");
		expect(row.followers.inlineDisplay).toBe(true);
		expect(row.followers.slugs).toEqual(["the-ring"]);        // the card holds a reference
		const ring = snap.followers.bySlug["the-ring"];           // resolved once in the registry
		expect(ring).toBeTruthy();
		expect(ring.isObject).toBe(true);                          // renders with no HP/armor/damage
	});

	it("keeps the owned Ring off the followers tab", async () => {
		const { character, arcanum } = characterWithRing();
		await character._onCreateDescendantDocuments([arcanum]);
		const snap = await character.buildSnapshot();
		expect(snap.followers.tab).not.toContain("the-ring");     // card-only, never on the roster
	});
});
