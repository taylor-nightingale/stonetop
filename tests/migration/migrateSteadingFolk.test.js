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

	// The payload is the right thing to assert here, and only here: schema cleaning has already taken
	// these keys out of the in-memory source, so the update is aimed at what is STORED and there is
	// nothing in `actor.system` left to watch disappear.
	it("asks for the two keys the merge replaced to be deleted", async () => {
		const actor = healedSteading();
		const updates = [];
		const update = actor.update.bind(actor);
		actor.update = data => { updates.push(data); return update(data); };

		await migrateSteadingFolk(actor);

		expect(updates[0]).toHaveProperty("system.-=residentPeople", null);
		expect(updates[0]).toHaveProperty("system.-=neighborPeople", null);
	});

	/**
	 * And that the ask REMOVES rather than adds. Seeded deliberately — a healed actor no longer holds
	 * these keys, so the fake stands in for the stored document here.
	 *
	 * Worth its own test because the fake used to get this wrong in the lenient direction: it had no
	 * handling for `-=` at the end of a dot path, so it stored a literal key called
	 * `-=residentPeople` and left the real one untouched. The assertion above passed throughout —
	 * a claim about what the code says can never catch that.
	 */
	it("removes them, rather than storing a key named -=", async () => {
		const actor = healedSteading({
			residentPeople: [{ name: "Bryn" }],
			neighborPeople: [{ name: "Seadha" }],
		});

		await migrateSteadingFolk(actor);

		expect(actor.system.residentPeople).toBeUndefined();
		expect(actor.system.neighborPeople).toBeUndefined();
		expect(Object.keys(actor.system).filter(k => k.startsWith("-="))).toEqual([]);
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
