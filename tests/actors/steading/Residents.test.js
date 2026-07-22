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

describe("Residents — document linking", () => {
	it("linkDocument stores the uuid on the person", async () => {
		const r = make();
		await r.add();
		const id = r.buildSnapshot()[0].id;
		await r.linkDocument(id, "Actor.xyz");
		expect(r.buildSnapshot()[0].linkUuid).toBe("Actor.xyz");
	});

	it("buildSnapshot exposes a docLink @UUID token for a linked resident", async () => {
		const r = make();
		await r.add();
		const id = r.buildSnapshot()[0].id;
		await r.linkDocument(id, "Actor.xyz");
		expect(r.buildSnapshot()[0].docLink.raw).toBe("@UUID[Actor.xyz]");
	});

	it("links any document type (a journal, not just an actor)", async () => {
		const r = make();
		await r.add();
		const id = r.buildSnapshot()[0].id;
		await r.linkDocument(id, "JournalEntry.j1");
		expect(r.buildSnapshot()[0].docLink.raw).toBe("@UUID[JournalEntry.j1]");
	});

	it("an unlinked resident has no docLink", async () => {
		const r = make();
		await r.add();
		expect(r.buildSnapshot()[0].docLink).toBeUndefined();
	});

	it("unlinkDocument clears the link", async () => {
		const r = make();
		await r.add();
		const id = r.buildSnapshot()[0].id;
		await r.linkDocument(id, "Actor.xyz");
		await r.unlinkDocument(id);
		expect("linkUuid" in r.buildSnapshot()[0]).toBe(false);
		expect(r.buildSnapshot()[0].docLink).toBeUndefined();
	});

	it("linking preserves the other fields", async () => {
		const r = make();
		await r.add();
		const id = r.buildSnapshot()[0].id;
		await r.updateName(id, "Aldric");
		await r.linkDocument(id, "Actor.xyz");
		expect(r.buildSnapshot()[0].name).toBe("Aldric");
	});
});

describe("Residents.updateTraitsSource", () => {
	it("parses one trait per line into system.residents.traits", async () => {
		const actor = new FakeActorBuilder().build();
		await new Residents(actor).updateTraitsSource("gruff\ncurious\nsuperstitious");
		expect(actor.system.residents.traits).toEqual(["gruff", "curious", "superstitious"]);
	});

	it("drops blank lines and trims whitespace", async () => {
		const actor = new FakeActorBuilder().build();
		await new Residents(actor).updateTraitsSource("  gruff  \n\n\t\ncurious\n");
		expect(actor.system.residents.traits).toEqual(["gruff", "curious"]);
	});

	it("empties the pool for empty or missing input", async () => {
		const actor = new FakeActorBuilder().build();
		await new Residents(actor).updateTraitsSource("");
		expect(actor.system.residents.traits).toEqual([]);
	});
});
