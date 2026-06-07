import { describe, expect, it } from "vitest";
import { migrateSteading } from "../../src/migration/migrateSteading.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";

function makeActor(flags = {}) {
	const builder = new FakeActorBuilder();
	builder._flagsBuilder.withFlags(flags);
	return builder.build();
}

describe("migrateSteading — improvements.pickValues", () => {
	it("migrates pickValues from flag to system", async () => {
		const actor = makeActor({ "improvements.pickValues": { "imp-1": 1 } });
		await migrateSteading(actor);
		expect(actor.system.improvements.pickValues).toEqual({ "imp-1": 1 });
	});

	it("is a no-op when pickValues flag is absent", async () => {
		const actor = makeActor({});
		await migrateSteading(actor);
		expect(actor.system.improvements?.pickValues).toBeUndefined();
	});
});

describe("migrateSteading — residents", () => {
	it("migrates residents from flag to system", async () => {
		const residents = [{ name: "Aldric", home: "east" }];
		const actor = makeActor({ "steading.residents": residents });
		await migrateSteading(actor);
		expect(actor.system.residents).toEqual(residents);
	});

	it("is a no-op when residents flag is absent", async () => {
		const actor = makeActor({});
		await migrateSteading(actor);
		expect(actor.system.residents).toBeUndefined();
	});
});

describe("migrateSteading — neighborPeople", () => {
	it("migrates neighborPeople from flag to system", async () => {
		const neighbors = [{ name: "Mira", home: "west" }];
		const actor = makeActor({ "steading.neighborPeople": neighbors });
		await migrateSteading(actor);
		expect(actor.system.neighborPeople).toEqual(neighbors);
	});

	it("is a no-op when neighborPeople flag is absent", async () => {
		const actor = makeActor({});
		await migrateSteading(actor);
		expect(actor.system.neighborPeople).toBeUndefined();
	});
});

describe("migrateSteading — all three fields together", () => {
	it("migrates all three fields in a single update", async () => {
		const residents = [{ name: "Aldric", home: "east" }];
		const neighbors = [{ name: "Mira", home: "west" }];
		const actor = makeActor({
			"improvements.pickValues": { "imp-1": 1 },
			"steading.residents": residents,
			"steading.neighborPeople": neighbors,
		});
		await migrateSteading(actor);
		expect(actor.system.improvements.pickValues).toEqual({ "imp-1": 1 });
		expect(actor.system.residents).toEqual(residents);
		expect(actor.system.neighborPeople).toEqual(neighbors);
	});
});
