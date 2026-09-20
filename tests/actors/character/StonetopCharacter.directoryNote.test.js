import { describe, it, expect } from "vitest";
import { TestCharacterBuilder } from "../../fakes/TestCharacterBuilder.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { TestPlaybookItemBuilder } from "../../fakes/TestPlaybookItemBuilder.js";

// What the sidebar's Actors tab writes beside this character's name. A real StonetopCharacter over a
// fake actor: the note is read off the embedded items, so a test that stubbed the playbook would be
// testing nothing the directory does.
function noteFor(items) {
	return new TestCharacterBuilder(new FakeCharacterActorBuilder().withItems(items).build())
		.build().directoryNote;
}

const wouldBeHero = new TestPlaybookItemBuilder()
	.withSlug("the-would-be-hero").withName("The Would-Be Hero")
	.withRenameOnMove({ moveSlug: "big-damn-hero", name: "The Hero" })
	.build();

const acquiredMove = slug => ({
	_id: `${slug}-item`, type: "move", name: slug,
	system: { slug, categoryKey: "playbook-the-would-be-hero", acquired: true, instanceCount: 1 },
});

describe("StonetopCharacter.directoryNote", () => {
	it("is null before a playbook is chosen", () => {
		expect(noteFor([])).toBeNull();
	});

	it("is the playbook the character plays", () => {
		expect(noteFor([wouldBeHero])).toBe("The Would-Be Hero");
	});

	// The sidebar quotes the front page, rename and all.
	it("follows the rename once Big Damn Hero is taken", () => {
		expect(noteFor([wouldBeHero, acquiredMove("big-damn-hero")])).toBe("The Hero");
	});

	it("is unmoved by some other move being taken", () => {
		expect(noteFor([wouldBeHero, acquiredMove("anger-is-a-gift")])).toBe("The Would-Be Hero");
	});
});
