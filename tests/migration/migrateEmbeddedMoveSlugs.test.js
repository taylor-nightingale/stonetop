import { describe, expect, it } from "vitest";
import { migrateEmbeddedMoveSlugs } from "../../src/migration/migrateCharacter.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";

function makeActor(items = []) {
	return new FakeActorBuilder().withItems(items).build();
}

const move = (id, name, system = {}) => ({ _id: id, type: "move", name, system });

describe("migrateEmbeddedMoveSlugs", () => {
	it("stamps system.slug = toSlug(name) onto moves that lack one", async () => {
		const actor = makeActor([move("m1", "Defy Danger")]);
		await migrateEmbeddedMoveSlugs(actor);
		expect(actor.updatedDocs).toContainEqual({ _id: "m1", system: { slug: "defy-danger" } });
	});

	it("leaves moves that already have a slug untouched", async () => {
		const actor = makeActor([move("m1", "Renamed", { slug: "original-slug" })]);
		await migrateEmbeddedMoveSlugs(actor);
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("ignores non-move items", async () => {
		const actor = makeActor([{ _id: "p1", type: "playbook", name: "The Fox", system: {} }]);
		await migrateEmbeddedMoveSlugs(actor);
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("is a no-op when there are no items", async () => {
		const actor = makeActor([]);
		await migrateEmbeddedMoveSlugs(actor);
		expect(actor.updatedDocs).toHaveLength(0);
	});
});
