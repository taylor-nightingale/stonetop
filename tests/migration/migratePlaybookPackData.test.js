import { describe, it, expect } from "vitest";
import { migratePlaybookPackData } from "../../src/migration/migrateCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakePlaybookRepository } from "../fakes/FakePlaybookRepository.js";
import { TestPlaybookItemBuilder } from "../fakes/TestPlaybookItemBuilder.js";

const OLD_BACKGROUND = { slug: "patriot", label: "Patriot", description: "These people are family." };
// What a pack regen adds to a background: the move it grants, and its own choice group.
const NEW_BACKGROUND = {
	slug: "patriot",
	label: "Patriot",
	description: "These people are family.",
	moves: ["lets-make-a-deal"],
	choices: {
		slug: "patriot",
		list: [{
			slug:    "hectumel-codex",
			type:    "entry",
			track:   { max: 1 },
			content: { title: null, text: "The Hec'tumel Codex" },
			grants:  [{ type: "arcanum", slug: "hectumel-codex", locations: ["tab"] }],
		}],
	},
};

const GROUP_A     = { slug: "group-a", list: [{ slug: "opt-a", type: "entry", content: { title: null, text: "Option A" } }] };
const GROUP_A_NEW = { slug: "group-a", list: [{ slug: "opt-a", type: "entry", content: { title: null, text: "Option A, corrected" } }] };
const GROUP_B     = { slug: "group-b", list: [{ slug: "opt-b", type: "entry", content: { title: null, text: "Option B" } }] };

const INTRO = {
	step3: "On your third turn, describe your sacred pouch.",
	step4: { slug: "intro-npc", list: [{ slug: "closest-kin", type: "entry", content: { title: null, text: "Who is your closest kin?" }, track: { max: 1 }, input: {} }] },
	step6: { slug: "intro-pc",  list: [{ slug: "hijinx",      type: "entry", content: { title: null, text: "Which one of you joined my latest hijinx?" }, track: { max: 1 }, input: {} }] },
};

function makeRepo(source = {}) {
	const repo = new FakePlaybookRepository();
	repo.add({ slug: "the-blessed", name: "The Blessed", ...source });
	return repo;
}

function playbookItem() {
	return new TestPlaybookItemBuilder();
}

function makeActor(item) {
	return new FakeCharacterActorBuilder().withItems([item.build()]).build();
}

describe("migratePlaybookPackData", () => {
	it("does nothing when the actor has no playbook item", async () => {
		const actor = new FakeCharacterActorBuilder().build();
		await migratePlaybookPackData(actor, makeRepo({ choices: [GROUP_A] }));
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("does nothing when the playbook item carries no slug", async () => {
		const actor = makeActor(playbookItem().withSlug(null));
		await migratePlaybookPackData(actor, makeRepo({ choices: [GROUP_A] }));
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("does nothing when the slug is not in the repo", async () => {
		const actor = makeActor(playbookItem());
		await migratePlaybookPackData(actor, new FakePlaybookRepository());
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("refreshes backgrounds that gained a granted move and a choice group", async () => {
		const actor = makeActor(playbookItem().withBackgrounds([OLD_BACKGROUND]));
		await migratePlaybookPackData(actor, makeRepo({ backgrounds: [NEW_BACKGROUND] }));

		const item = actor.items.get("playbook-item");
		expect(item.system.backgrounds).toEqual([NEW_BACKGROUND]);
	});

	// The old pass only fired when a whole group slug was missing, so an edit inside an existing
	// group never reached a character in play.
	it("refreshes a choice group edited in place, not just an added one", async () => {
		const actor = makeActor(playbookItem().withChoices([GROUP_A]));
		await migratePlaybookPackData(actor, makeRepo({ choices: [GROUP_A_NEW] }));

		expect(actor.items.get("playbook-item").system.choices).toEqual([GROUP_A_NEW]);
	});

	it("refreshes an added choice group", async () => {
		const actor = makeActor(playbookItem().withChoices([GROUP_A]));
		await migratePlaybookPackData(actor, makeRepo({ choices: [GROUP_A, GROUP_B] }));

		expect(actor.items.get("playbook-item").system.choices).toEqual([GROUP_A, GROUP_B]);
	});

	it("refreshes introductions", async () => {
		const actor = makeActor(playbookItem().withIntroductions(null));
		await migratePlaybookPackData(actor, makeRepo({ introductions: INTRO }));

		expect(actor.items.get("playbook-item").system.introductions).toEqual(INTRO);
	});

	it("refreshes the remaining authored fields", async () => {
		const actor = makeActor(playbookItem().withDescription("stale").withStatsNote("stale"));
		await migratePlaybookPackData(actor, makeRepo({
			description:        "Look at us.",
			statsNote:          "Assign these scores: +2, +1, +1, +0, +0, -1",
			startingMovesNote:  "You start with Well Versed.",
			hp:                 16,
			damage:             { value: "d6" },
			origin:             [{ region: "Stonetop", names: ["Ania"] }],
			moves:              ["polyglot", "magpie"],
			startingMoves:      ["well-versed"],
			followers:          ["a-follower"],
			inserts:            ["an-insert"],
			specialPossessions: { slugs: ["scribes-tools"], pickCount: 2, pickNote: "Pick 2", preselected: ["scribes-tools"] },
			instinct:           { slug: "instinct", list: [] },
			appearance:         { slug: "appearance", list: [] },
		}));

		const sys = actor.items.get("playbook-item").system;
		expect(sys.description).toBe("Look at us.");
		expect(sys.statsNote).toBe("Assign these scores: +2, +1, +1, +0, +0, -1");
		expect(sys.startingMovesNote).toBe("You start with Well Versed.");
		expect(sys.hp).toBe(16);
		expect(sys.damage).toEqual({ value: "d6" });
		expect(sys.origin).toEqual([{ region: "Stonetop", names: ["Ania"] }]);
		expect(sys.moves).toEqual(["polyglot", "magpie"]);
		expect(sys.startingMoves).toEqual(["well-versed"]);
		expect(sys.followers).toEqual(["a-follower"]);
		expect(sys.inserts).toEqual(["an-insert"]);
		expect(sys.specialPossessions.slugs).toEqual(["scribes-tools"]);
		expect(sys.instinct).toEqual({ slug: "instinct", list: [] });
		expect(sys.appearance).toEqual({ slug: "appearance", list: [] });
	});

	it("preserves the player's stored choice values", async () => {
		const item = playbookItem()
			.withBackgrounds([OLD_BACKGROUND])
			.withChoices([GROUP_A])
			.withChoiceValues({ instinct: { curious: 1 } })
			.build();
		item.system.backgroundValues = { patriot: { "hectumel-codex": 1 } };
		item.system.instinctValues   = { curious: 1 };
		item.system.appearanceValues = { young: 1 };
		const actor = new FakeCharacterActorBuilder().withItems([item]).build();

		await migratePlaybookPackData(actor, makeRepo({ backgrounds: [NEW_BACKGROUND], choices: [GROUP_A_NEW] }));

		const sys = actor.items.get("playbook-item").system;
		expect(sys.choiceValues).toEqual({ instinct: { curious: 1 } });
		expect(sys.backgroundValues).toEqual({ patriot: { "hectumel-codex": 1 } });
		expect(sys.instinctValues).toEqual({ curious: 1 });
		expect(sys.appearanceValues).toEqual({ young: 1 });
	});

	it("leaves a GM's rename alone", async () => {
		const actor = makeActor(playbookItem().withName("Brakken's Playbook"));
		await migratePlaybookPackData(actor, makeRepo({ name: "The Blessed", choices: [GROUP_A] }));

		expect(actor.items.get("playbook-item").name).toBe("Brakken's Playbook");
	});

	// Foundry MERGES an object-field update into what is stored, so a key the pack has since dropped
	// would survive a plain write — the refresh has to clear those fields first.
	it("drops a key the pack no longer ships", async () => {
		const actor = makeActor(playbookItem().withSpecialPossessions({ slugs: ["a"], legacyKey: "stale" }));
		await migratePlaybookPackData(actor, makeRepo({ specialPossessions: { slugs: ["a", "b"] } }));

		expect(actor.items.get("playbook-item").system.specialPossessions).toEqual({ slugs: ["a", "b"] });
	});

	it("is idempotent", async () => {
		const actor = makeActor(playbookItem().withBackgrounds([OLD_BACKGROUND]));
		const repo  = makeRepo({ backgrounds: [NEW_BACKGROUND], choices: [GROUP_A] });

		await migratePlaybookPackData(actor, repo);
		const first = JSON.parse(JSON.stringify(actor.items.get("playbook-item").system));
		await migratePlaybookPackData(actor, repo);

		expect(actor.items.get("playbook-item").system).toEqual(first);
	});
});

describe("migratePlaybookPackData and the world's language", () => {
	const GERMAN_BACKGROUND = { ...NEW_BACKGROUND, label: "Patriot", description: "Diese Leute sind Familie." };

	// The prepared playbook carries the world's language; only its source is the English the pack was
	// built from. Copying the prepared form would bake German into the character for good.
	it("copies the untranslated source onto the actor, not the translated prepared data", async () => {
		const repo = new FakePlaybookRepository();
		repo.add({ slug: "the-blessed", name: "Der Gesegnete", backgrounds: [GERMAN_BACKGROUND] });
		repo.addSource({ slug: "the-blessed", name: "The Blessed", backgrounds: [NEW_BACKGROUND] });

		const actor = makeActor(playbookItem().withBackgrounds([OLD_BACKGROUND]));
		await migratePlaybookPackData(actor, repo);

		expect(actor.items.get("playbook-item").system.backgrounds).toEqual([NEW_BACKGROUND]);
	});
});
