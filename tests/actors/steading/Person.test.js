import { describe, it, expect } from "vitest";
import { Person } from "../../../src/actors/steading/Person.js";

describe("Person.blank", () => {
	it("has a non-empty id", () => {
		expect(Person.blank().id).toBeTruthy();
	});

	it("has empty name, occupation, traits", () => {
		const p = Person.blank();
		expect(p.name).toBe("");
		expect(p.occupation).toBe("");
		expect(p.traits).toBe("");
	});

	it("does not have a home field", () => {
		expect("home" in Person.blank()).toBe(false);
	});

	it("does not have a linkUuid field", () => {
		expect("linkUuid" in Person.blank()).toBe(false);
	});

	it("each call produces a unique id", () => {
		expect(Person.blank().id).not.toBe(Person.blank().id);
	});
});

describe("Person.blankNeighbor", () => {
	it("has a non-empty id", () => {
		expect(Person.blankNeighbor().id).toBeTruthy();
	});

	it("has empty name, occupation, traits", () => {
		const p = Person.blankNeighbor();
		expect(p.name).toBe("");
		expect(p.occupation).toBe("");
		expect(p.traits).toBe("");
	});

	it("has an empty home field", () => {
		expect(Person.blankNeighbor().home).toBe("");
	});
});

describe("Person with-methods", () => {
	it("withName returns a new Person with the updated name", () => {
		const p = Person.fromRaw({id: "abc", name: "Aldric", occupation: "Smith", traits: "Gruff"});
		const updated = p.withName("Bryn");
		expect(updated.name).toBe("Bryn");
		expect(updated.id).toBe("abc");
		expect(updated.occupation).toBe("Smith");
		expect(updated.traits).toBe("Gruff");
	});

	it("withOccupation returns a new Person with the updated occupation", () => {
		const p = Person.blank();
		expect(p.withOccupation("Miller").occupation).toBe("Miller");
	});

	it("withTraits returns a new Person with the updated traits", () => {
		const p = Person.blank();
		expect(p.withTraits("Quiet").traits).toBe("Quiet");
	});

	it("withHome returns a new Person with the updated home", () => {
		const p = Person.blankNeighbor();
		expect(p.withHome("Marshedge").home).toBe("Marshedge");
	});

	it("withLink returns a new Person carrying the document uuid, preserving other fields", () => {
		const p = Person.fromRaw({id: "abc", name: "Aldric", occupation: "Smith", traits: "Gruff"});
		const linked = p.withLink("Actor.xyz");
		expect(linked.linkUuid).toBe("Actor.xyz");
		expect(linked.name).toBe("Aldric");
		expect(linked.occupation).toBe("Smith");
	});

	it("withoutLink drops the linkUuid field", () => {
		const p = Person.fromRaw({id: "abc", name: "Aldric", linkUuid: "Actor.xyz"});
		const unlinked = p.withoutLink();
		expect("linkUuid" in unlinked).toBe(false);
		expect(unlinked.name).toBe("Aldric");
	});

	it("with-methods do not mutate the original", () => {
		const p = Person.blank();
		p.withName("Aldric");
		expect(p.name).toBe("");
	});
});

describe("Person.fromRaw", () => {
	it("round-trips a resident (no home)", () => {
		const p = Person.fromRaw({id: "abc", name: "Aldric", occupation: "Smith", traits: "Gruff"});
		expect(p.id).toBe("abc");
		expect(p.name).toBe("Aldric");
		expect(p.occupation).toBe("Smith");
		expect(p.traits).toBe("Gruff");
		expect("home" in p).toBe(false);
	});

	it("round-trips a neighbor person (with home)", () => {
		const p = Person.fromRaw({id: "abc", name: "Maren", occupation: "Merchant", traits: "Cunning", home: "Marshedge"});
		expect(p.home).toBe("Marshedge");
	});

	it("round-trips a linked document uuid", () => {
		const p = Person.fromRaw({id: "abc", name: "Maren", linkUuid: "JournalEntry.xyz"});
		expect(p.linkUuid).toBe("JournalEntry.xyz");
	});

	it("omits linkUuid when absent", () => {
		expect("linkUuid" in Person.fromRaw({id: "abc"})).toBe(false);
	});

	it("defaults missing fields to empty string", () => {
		const p = Person.fromRaw({id: "abc"});
		expect(p.name).toBe("");
		expect(p.occupation).toBe("");
		expect(p.traits).toBe("");
	});
});
