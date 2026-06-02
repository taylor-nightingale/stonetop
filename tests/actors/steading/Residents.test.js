import { describe, it, expect } from "vitest";
import { Residents } from "../../../src/actors/steading/Residents.js";
import { Person } from "../../../src/actors/steading/Person.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";

function make() {
	return new Residents(new FakeActorBuilder().build());
}

describe("Residents.add", () => {
	it("creates a Person with no home field", async () => {
		const r = make();
		await r.add();
		expect(r.buildSnapshot()[0]).toBeInstanceOf(Person);
		expect("home" in r.buildSnapshot()[0]).toBe(false);
	});

	it("creates blank name, occupation, traits", async () => {
		const r = make();
		await r.add();
		const p = r.buildSnapshot()[0];
		expect(p.name).toBe("");
		expect(p.occupation).toBe("");
		expect(p.traits).toBe("");
	});
});

describe("Residents.remove", () => {
	it("removes by id", async () => {
		const r = make();
		await r.add();
		await r.remove(r.buildSnapshot()[0].id);
		expect(r.buildSnapshot()).toHaveLength(0);
	});
});

describe("Residents — named update methods", () => {
	it("updateName updates name and preserves other fields", async () => {
		const r = make();
		await r.add();
		const id = r.buildSnapshot()[0].id;
		await r.updateName(id, "Aldric");
		const p = r.buildSnapshot()[0];
		expect(p.name).toBe("Aldric");
		expect(p.occupation).toBe("");
		expect(p.traits).toBe("");
	});

	it("updateOccupation updates occupation and preserves other fields", async () => {
		const r = make();
		await r.add();
		const id = r.buildSnapshot()[0].id;
		await r.updateOccupation(id, "Blacksmith");
		expect(r.buildSnapshot()[0].occupation).toBe("Blacksmith");
		expect(r.buildSnapshot()[0].name).toBe("");
	});

	it("updateTraits updates traits and preserves other fields", async () => {
		const r = make();
		await r.add();
		const id = r.buildSnapshot()[0].id;
		await r.updateTraits(id, "Gruff but reliable");
		expect(r.buildSnapshot()[0].traits).toBe("Gruff but reliable");
		expect(r.buildSnapshot()[0].name).toBe("");
	});
});
