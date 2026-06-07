import { describe, expect, it } from "vitest";
import { migrateInsertChoiceValues } from "../../src/migration/migrateCharacter.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";

function makeInsertItem(choiceValues = {}) {
	return { _id: "ins1", type: "insert", name: "Thrall", system: { slug: "thrall", choiceValues } };
}

function makeActor(flags = {}, items = []) {
	const builder = new FakeActorBuilder().withItems(items);
	builder._flagsBuilder.withFlags(flags);
	return builder.build();
}

describe("migrateInsertChoiceValues — gate", () => {
	it("is a no-op when no insert item exists", async () => {
		const actor = makeActor({});
		await migrateInsertChoiceValues(actor);
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("is a no-op when insert item already has choiceValues", async () => {
		const actor = makeActor({}, [makeInsertItem({ instinct: { fascination: 1 } })]);
		await migrateInsertChoiceValues(actor);
		expect(actor.updatedDocs).toHaveLength(0);
	});
});

describe("migrateInsertChoiceValues — merges flags into choiceValues", () => {
	it("reads postDeathChoices.values from flags and writes to insert item", async () => {
		const actor = makeActor(
			{ "postDeathChoices.values": { instinct: { fascination: 1, resistance: 0 } } },
			[makeInsertItem()],
		);
		await migrateInsertChoiceValues(actor);
		const update = actor.updatedDocs.find(u => u._id === "ins1");
		expect(update?.system.choiceValues?.instinct).toEqual({ fascination: 1, resistance: 0 });
	});

	it("reads postDeathLore.values from flags and writes to insert item", async () => {
		const actor = makeActor(
			{ "postDeathLore.values": { impulse: { "inflict-harm": 1 }, marks: { "festering-rot": 1 } } },
			[makeInsertItem()],
		);
		await migrateInsertChoiceValues(actor);
		const update = actor.updatedDocs.find(u => u._id === "ins1");
		expect(update?.system.choiceValues?.impulse).toEqual({ "inflict-harm": 1 });
		expect(update?.system.choiceValues?.marks).toEqual({ "festering-rot": 1 });
	});

	it("merges both postDeathChoices and postDeathLore, with choices taking precedence", async () => {
		const actor = makeActor(
			{
				"postDeathChoices.values": { instinct: { fascination: 1 } },
				"postDeathLore.values":    { impulse:  { "inflict-harm": 1 } },
			},
			[makeInsertItem()],
		);
		await migrateInsertChoiceValues(actor);
		const update = actor.updatedDocs.find(u => u._id === "ins1");
		expect(update?.system.choiceValues?.instinct).toEqual({ fascination: 1 });
		expect(update?.system.choiceValues?.impulse).toEqual({ "inflict-harm": 1 });
	});

	it("is a no-op when both flag values are empty", async () => {
		const actor = makeActor({}, [makeInsertItem()]);
		await migrateInsertChoiceValues(actor);
		expect(actor.updatedDocs).toHaveLength(0);
	});
});
