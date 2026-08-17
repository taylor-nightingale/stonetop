import { describe, it, expect } from "vitest";
import { migrateArcanumSlugs } from "../../src/migration/migrateCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";

function makeActor(items = []) {
	return new FakeCharacterActorBuilder().withItems(items).build();
}

function arcanum(id, name, slug) {
	return { _id: id, type: "arcanum", name, system: { slug, front: {}, back: {} } };
}

// Every arcana pass matches on `system.slug`, and each runs once per world migration — so an arcanum
// that lost its slug (converted from a legacy `equipment` item that never carried one) is skipped by
// all of them, permanently, and keeps showing whatever content it had when it was converted.
describe("migrateArcanumSlugs", () => {
	it("stamps a slug derived from the name", async () => {
		const actor = makeActor([arcanum("a1", "Hec’tumel Codex", null)]);
		await migrateArcanumSlugs(actor);
		expect(actor.items.get("a1").system.slug).toBe("hectumel-codex");
	});

	it("never overwrites a slug the item already has", async () => {
		const actor = makeActor([arcanum("a1", "Renamed By The GM", "hectumel-codex")]);
		await migrateArcanumSlugs(actor);
		expect(actor.updatedDocs).toHaveLength(0);
		expect(actor.items.get("a1").system.slug).toBe("hectumel-codex");
	});

	it("leaves items of other types alone", async () => {
		const actor = makeActor([{ _id: "m1", type: "move", name: "Hack And Slash", system: {} }]);
		await migrateArcanumSlugs(actor);
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("skips an unnamed arcanum rather than stamping an empty slug", async () => {
		const actor = makeActor([arcanum("a1", "", null)]);
		await migrateArcanumSlugs(actor);
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("stamps every slugless arcanum in one batch", async () => {
		const actor = makeActor([arcanum("a1", "The Mindgem", null), arcanum("a2", "Azure Hand", null)]);
		await migrateArcanumSlugs(actor);
		expect(actor.updatedDocs.map(u => u.system.slug)).toEqual(["the-mindgem", "azure-hand"]);
	});
});
