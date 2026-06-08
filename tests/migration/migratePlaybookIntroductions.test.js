import { describe, it, expect } from "vitest";
import { migratePlaybookIntroductions } from "../../src/migration/migrateCharacter.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";
import { FakePlaybookRepository } from "../fakes/FakePlaybookRepository.js";
import { TestPlaybookItemBuilder } from "../fakes/TestPlaybookItemBuilder.js";

const INTRO = {
	step3: "On your third turn, describe your sacred pouch.",
	step4: { slug: "intro-npc", list: [{ slug: "closest-kin", type: "entry", content: { title: null, text: "Who is your closest kin?" }, track: { max: 1 }, input: {} }] },
	step6: { slug: "intro-pc",  list: [{ slug: "hijinx",      type: "entry", content: { title: null, text: "Which one of you joined my latest hijinx?" }, track: { max: 1 }, input: {} }] },
};

const INTRO_NO_INPUT = {
	step3: "On your third turn, describe your sacred pouch.",
	step4: { slug: "intro-npc", list: [{ slug: "closest-kin", type: "entry", content: { title: null, text: "Who is your closest kin?" }, track: { max: 1 } }] },
	step6: { slug: "intro-pc",  list: [{ slug: "hijinx",      type: "entry", content: { title: null, text: "Which one of you joined my latest hijinx?" }, track: { max: 1 } }] },
};

function makeActor(introductions = null) {
	const item = new TestPlaybookItemBuilder().withIntroductions(introductions).build();
	return new FakeActorBuilder().withItems([item]).build();
}

function makeRepo(introductions = null) {
	const repo = new FakePlaybookRepository();
	repo.add({ slug: "the-blessed", name: "The Blessed", introductions });
	return repo;
}

describe("migratePlaybookIntroductions", () => {
	it("does nothing when actor has no playbook item", async () => {
		const actor = new FakeActorBuilder().build();
		await migratePlaybookIntroductions(actor, makeRepo(INTRO));
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("skips when introductions is already a valid object with step4", async () => {
		const actor = makeActor(INTRO);
		await migratePlaybookIntroductions(actor, makeRepo(INTRO));
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("updates when introductions is null", async () => {
		const actor = makeActor(null);
		await migratePlaybookIntroductions(actor, makeRepo(INTRO));
		expect(actor.updatedDocs).toHaveLength(1);
		expect(actor.updatedDocs[0].system.introductions).toEqual(INTRO);
	});

	it("updates when introductions is a stale array", async () => {
		const item = new TestPlaybookItemBuilder().build();
		item.system.introductions = [];
		const actor = new FakeActorBuilder().withItems([item]).build();
		await migratePlaybookIntroductions(actor, makeRepo(INTRO));
		expect(actor.updatedDocs).toHaveLength(1);
		expect(actor.updatedDocs[0].system.introductions).toEqual(INTRO);
	});

	it("does nothing when slug not found in repo", async () => {
		const actor = makeActor(null);
		await migratePlaybookIntroductions(actor, new FakePlaybookRepository());
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("does nothing when compendium has no introductions", async () => {
		const actor = makeActor(null);
		await migratePlaybookIntroductions(actor, makeRepo(null));
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("updates when introductions has step4 but questions lack input fields", async () => {
		const actor = makeActor(INTRO_NO_INPUT);
		await migratePlaybookIntroductions(actor, makeRepo(INTRO));
		expect(actor.updatedDocs).toHaveLength(1);
		expect(actor.updatedDocs[0].system.introductions).toEqual(INTRO);
	});
});
