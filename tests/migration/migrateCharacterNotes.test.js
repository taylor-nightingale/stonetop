import { describe, expect, it } from "vitest";
import { migrateCharacterNotes } from "../../src/migration/migrateCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";

function makeActor({ description = "", notes = "" } = {}) {
	return new FakeCharacterActorBuilder()
		.withDescription(description)
		.withNotes(notes)
		.build();
}

describe("migrateCharacterNotes", () => {
	it("converts the plain-text bio to paragraph HTML", async () => {
		const actor = makeActor({ description: "A wanderer.\nFar from home.\n\nSeeking the barrow." });
		await migrateCharacterNotes(actor);
		expect(actor.system.description)
			.toBe("<p>A wanderer.<br>Far from home.</p><p>Seeking the barrow.</p>");
	});

	it("converts the plain-text notes to paragraph HTML", async () => {
		const actor = makeActor({ notes: "Ask Isadora about the **key**" });
		await migrateCharacterNotes(actor);
		expect(actor.system.notes).toBe("<p>Ask Isadora about the <strong>key</strong></p>");
	});

	it("leaves values the editor already saved untouched", async () => {
		const html = "<p>Saved by ProseMirror</p>";
		const actor = makeActor({ description: html, notes: html });
		await migrateCharacterNotes(actor);
		expect(actor.system.description).toBe(html);
		expect(actor.system.notes).toBe(html);
	});

	it("leaves empty fields empty", async () => {
		const actor = makeActor();
		await migrateCharacterNotes(actor);
		expect(actor.system.description).toBe("");
		expect(actor.system.notes).toBe("");
	});

	it("is idempotent", async () => {
		const actor = makeActor({ description: "First.\n\nSecond.", notes: "A note" });
		await migrateCharacterNotes(actor);
		const once = { description: actor.system.description, notes: actor.system.notes };
		await migrateCharacterNotes(actor);
		expect(actor.system.description).toBe(once.description);
		expect(actor.system.notes).toBe(once.notes);
	});
});
