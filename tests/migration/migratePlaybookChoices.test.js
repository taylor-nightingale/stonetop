import { describe, it, expect } from "vitest";
import { migratePlaybookChoices } from "../../src/migration/migrateCharacter.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";
import { FakePlaybookRepository } from "../fakes/FakePlaybookRepository.js";
import { TestPlaybookItemBuilder } from "../fakes/TestPlaybookItemBuilder.js";

const GROUP_A = { slug: "group-a", list: [{ slug: "opt-a", type: "entry", content: { title: null, text: "Option A" } }] };
const GROUP_B = { slug: "group-b", list: [{ slug: "opt-b", type: "entry", content: { title: null, text: "Option B" } }] };

function makeActor(choices = []) {
	const item = new TestPlaybookItemBuilder().withChoices(choices).build();
	return new FakeActorBuilder().withItems([item]).build();
}

function makeRepo(choices = []) {
	const repo = new FakePlaybookRepository();
	repo.add({ slug: "the-blessed", name: "The Blessed", choices });
	return repo;
}

describe("migratePlaybookChoices", () => {
	it("does nothing when actor has no playbook item", async () => {
		const actor = new FakeActorBuilder().build();
		await migratePlaybookChoices(actor, makeRepo([GROUP_A]));
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("does nothing when all groups already present", async () => {
		const actor = makeActor([GROUP_A, GROUP_B]);
		await migratePlaybookChoices(actor, makeRepo([GROUP_A, GROUP_B]));
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("updates when a group is missing from the embedded item", async () => {
		const actor = makeActor([GROUP_A]);
		await migratePlaybookChoices(actor, makeRepo([GROUP_A, GROUP_B]));
		expect(actor.updatedDocs).toHaveLength(1);
		expect(actor.updatedDocs[0].system.choices).toEqual([GROUP_A, GROUP_B]);
	});

	it("updates when embedded item has no choices at all", async () => {
		const actor = makeActor([]);
		await migratePlaybookChoices(actor, makeRepo([GROUP_A]));
		expect(actor.updatedDocs).toHaveLength(1);
		expect(actor.updatedDocs[0].system.choices).toEqual([GROUP_A]);
	});

	it("does nothing when slug not found in repo", async () => {
		const actor = makeActor([]);
		await migratePlaybookChoices(actor, new FakePlaybookRepository());
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("does nothing when compendium has no choices", async () => {
		const actor = makeActor([]);
		await migratePlaybookChoices(actor, makeRepo([]));
		expect(actor.updatedDocs).toHaveLength(0);
	});
});
