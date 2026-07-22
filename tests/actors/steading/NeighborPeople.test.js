import { describe, it, expect } from "vitest";
import { NeighborPeople } from "../../../src/actors/steading/NeighborPeople.js";
import { Person } from "../../../src/actors/steading/Person.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";

function make() {
	return new NeighborPeople(new FakeActorBuilder().build());
}

describe("NeighborPeople.add", () => {
	it("creates a Person with an empty home field", async () => {
		const n = make();
		await n.add();
		expect(n.buildSnapshot()[0]).toBeInstanceOf(Person);
		expect(n.buildSnapshot()[0].home).toBe("");
	});

	it("creates blank name, occupation, traits", async () => {
		const n = make();
		await n.add();
		const p = n.buildSnapshot()[0];
		expect(p.name).toBe("");
		expect(p.occupation).toBe("");
		expect(p.traits).toBe("");
	});
});

describe("NeighborPeople.remove", () => {
	it("removes by id", async () => {
		const n = make();
		await n.add();
		await n.remove(n.buildSnapshot()[0].id);
		expect(n.buildSnapshot()).toHaveLength(0);
	});
});

describe("NeighborPeople — named update methods", () => {
	it("updateName updates name and preserves other fields", async () => {
		const n = make();
		await n.add();
		const id = n.buildSnapshot()[0].id;
		await n.updateName(id, "Maren");
		const p = n.buildSnapshot()[0];
		expect(p.name).toBe("Maren");
		expect(p.home).toBe("");
		expect(p.occupation).toBe("");
	});

	it("updateOccupation updates occupation", async () => {
		const n = make();
		await n.add();
		const id = n.buildSnapshot()[0].id;
		await n.updateOccupation(id, "Merchant");
		expect(n.buildSnapshot()[0].occupation).toBe("Merchant");
	});

	it("updateTraits updates traits", async () => {
		const n = make();
		await n.add();
		const id = n.buildSnapshot()[0].id;
		await n.updateTraits(id, "Cunning");
		expect(n.buildSnapshot()[0].traits).toBe("Cunning");
	});

	it("updateHome updates home and preserves other fields", async () => {
		const n = make();
		await n.add();
		const id = n.buildSnapshot()[0].id;
		await n.updateHome(id, "Marshedge");
		const p = n.buildSnapshot()[0];
		expect(p.home).toBe("Marshedge");
		expect(p.name).toBe("");
		expect(p.occupation).toBe("");
	});
});

describe("NeighborPeople — document linking", () => {
	it("linkDocument stores the uuid and exposes a docLink @UUID token", async () => {
		const n = make();
		await n.add();
		const id = n.buildSnapshot()[0].id;
		await n.linkDocument(id, "Actor.xyz");
		expect(n.buildSnapshot()[0].linkUuid).toBe("Actor.xyz");
		expect(n.buildSnapshot()[0].docLink.raw).toBe("@UUID[Actor.xyz]");
	});

	it("linking preserves the home field", async () => {
		const n = make();
		await n.add();
		const id = n.buildSnapshot()[0].id;
		await n.updateHome(id, "Marshedge");
		await n.linkDocument(id, "Actor.xyz");
		expect(n.buildSnapshot()[0].home).toBe("Marshedge");
	});

	it("unlinkDocument clears the link", async () => {
		const n = make();
		await n.add();
		const id = n.buildSnapshot()[0].id;
		await n.linkDocument(id, "Actor.xyz");
		await n.unlinkDocument(id);
		expect("linkUuid" in n.buildSnapshot()[0]).toBe(false);
	});
});
