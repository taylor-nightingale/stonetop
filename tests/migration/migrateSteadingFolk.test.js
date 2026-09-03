import { describe, expect, it } from "vitest";
import { migrateSteadingFolk } from "../../src/migration/migrateSteadingFolk.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";

// The runner sees the actor AFTER SteadingData.migrateData healed its shape, so `system` already
// holds the merged roster and the object-shaped assets (that path is covered in
// migrateSteadingShape.test.js). This pass only writes what is already true back to the database and
// drops the two keys the merge replaced — which is the only way they ever leave a world, since schema
// cleaning has already removed them from the in-memory source.
function healedSteading(system = {}) {
	return new FakeActorBuilder().withType("steading").withSystem({
		steadfast: "stonetop",
		folk: [{ id: "1", name: "Bryn", home: "" }, { id: "2", name: "Seadha", home: "Marshedge" }],
		assets: { items: [{ text: "A wagon", requisitioned: true }], resources: [], fortifications: [], coinage: [] },
		...system,
	}).build();
}

describe("migrateSteadingFolk", () => {
	it("persists the merged roster", async () => {
		const actor = healedSteading();
		await migrateSteadingFolk(actor);
		expect(actor.system.folk.map(p => p.name)).toEqual(["Bryn", "Seadha"]);
	});

	it("deletes the two keys the merge replaced", async () => {
		const actor = healedSteading();
		const updates = [];
		const update = actor.update.bind(actor);
		actor.update = data => { updates.push(data); return update(data); };

		await migrateSteadingFolk(actor);

		expect(updates[0]).toHaveProperty("system.-=residentPeople", null);
		expect(updates[0]).toHaveProperty("system.-=neighborPeople", null);
	});

	it("persists the assets with their requisitioned state", async () => {
		const actor = healedSteading();
		await migrateSteadingFolk(actor);
		expect(actor.system.assets.items).toEqual([{ text: "A wagon", requisitioned: true }]);
	});

	// It runs once per world upgrade, so running it twice must be the same as running it once.
	it("is idempotent", async () => {
		const actor = healedSteading();
		await migrateSteadingFolk(actor);
		const after = structuredClone(actor.system);
		await migrateSteadingFolk(actor);
		expect(actor.system).toEqual(after);
	});

	it("copes with a steading that has no roster and no assets yet", async () => {
		const actor = new FakeActorBuilder().withType("steading").withSystem({ steadfast: "stonetop" }).build();
		await migrateSteadingFolk(actor);
		expect(actor.system.folk).toEqual([]);
		expect(actor.system.assets.items).toEqual([]);
	});
});
