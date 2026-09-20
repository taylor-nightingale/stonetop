import { describe, it, expect } from "vitest";
import { migratePlaybookPackData } from "../../src/migration/migrateCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakePlaybookRepository } from "../fakes/FakePlaybookRepository.js";
import { TestPlaybookItemBuilder } from "../fakes/TestPlaybookItemBuilder.js";
import { TestCharacterBuilder } from "../fakes/TestCharacterBuilder.js";
import { StonetopPlaybook } from "../../src/item/StonetopPlaybook.js";

// The upgrade path, end to end: a character who took Big Damn Hero BEFORE the system knew the move
// renames the playbook. Nothing about their moves needs fixing — the item is already acquired, so
// the slug is already in acquiredSlugs — but the playbook item embedded on them predates
// `renameOnMove`, and until the pack refresh puts it there the front page and the sidebar both keep
// calling them The Would-be Hero.
//
// Real StonetopCharacter, real migration pass, real StonetopPlaybook wrapper; only Foundry is faked.

// The playbook item as it was embedded before the field existed.
const oldPlaybookItem = () => new TestPlaybookItemBuilder()
	.withSlug("the-would-be-hero").withName("The Would-Be Hero")
	.build();

const bigDamnHero = {
	_id: "big-damn-hero-item", type: "move", name: "Big Damn Hero",
	system: { slug: "big-damn-hero", categoryKey: "playbook-the-would-be-hero", acquired: true, instanceCount: 1 },
};

const packWithRename = () => new FakePlaybookRepository().addSource(new StonetopPlaybook({
	name: "The Would-Be Hero",
	system: {
		slug: "the-would-be-hero",
		renameOnMove: { moveSlug: "big-damn-hero", name: "The Hero" },
	},
}));

function characterOn(actor) {
	return new TestCharacterBuilder(actor).build();
}

describe("a character who took Big Damn Hero before the rename shipped", () => {
	it("is still called The Would-be Hero until the migration runs", () => {
		const actor = new FakeCharacterActorBuilder().withItems([oldPlaybookItem(), bigDamnHero]).build();
		expect(characterOn(actor).directoryNote).toBe("The Would-Be Hero");
	});

	it("is The Hero once the pack refresh has reached them", async () => {
		const actor = new FakeCharacterActorBuilder().withItems([oldPlaybookItem(), bigDamnHero]).build();

		await migratePlaybookPackData(actor, packWithRename());

		expect(characterOn(actor).directoryNote).toBe("The Hero");
	});

	// The move is what does it, not the migration: a Would-be Hero who never took it keeps the name.
	it("leaves a character who never took the move alone", async () => {
		const actor = new FakeCharacterActorBuilder().withItems([oldPlaybookItem()]).build();

		await migratePlaybookPackData(actor, packWithRename());

		expect(characterOn(actor).directoryNote).toBe("The Would-Be Hero");
	});
});
