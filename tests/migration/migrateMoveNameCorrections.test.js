import { describe, it, expect } from "vitest";
import { migrateMoveNameCorrections } from "../../src/migration/migrateMoveNameCorrections.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";

// The pack refresh never touches a move's name, so a GM's rename survives it. That also means a name
// the pack misspelt stays misspelt on every character that already carries the move.

const move = (name, slug = "deaths-door") => ({ _id: `m-${slug}`, type: "move", name, system: { slug } });

const run = async items => {
	const actor = new FakeCharacterActorBuilder().withItems(items).build();
	await migrateMoveNameCorrections(actor);
	return actor;
};

describe("migrateMoveNameCorrections", () => {
	it("corrects the pack's old spelling of Death's Door", async () => {
		const actor = await run([move("Deaths Door")]);
		expect(actor.items.get("m-deaths-door").name).toBe("Death's Door");
	});

	it("leaves a name a GM chose", async () => {
		const actor = await run([move("The Lady's Door")]);
		expect(actor.updatedDocs).toHaveLength(0);
	});

	// A translated world carries the translation, which was never misspelt.
	it("leaves a translated name", async () => {
		const actor = await run([move("An der Schwelle des Todes")]);
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("only corrects the move the spelling belongs to", async () => {
		const actor = await run([move("Deaths Door", "homebrew-door")]);
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("ignores items that are not moves", async () => {
		const actor = await run([{ _id: "p1", type: "possession", name: "Deaths Door", system: { slug: "deaths-door" } }]);
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("writes nothing once the name is right", async () => {
		const actor = await run([move("Death's Door")]);
		expect(actor.updatedDocs).toHaveLength(0);
	});
});
