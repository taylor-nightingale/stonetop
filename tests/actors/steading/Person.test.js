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

	// One roster: everyone carries a home, and blank means this steading. There is no second blank.
	it("has an empty home", () => {
		expect(Person.blank().home).toBe("");
	});

	it("does not have a linkUuid field", () => {
		expect("linkUuid" in Person.blank()).toBe(false);
	});

	it("each call produces a unique id", () => {
		expect(Person.blank().id).not.toBe(Person.blank().id);
	});
});

describe("Person.named", () => {
	it("carries the name it was given and a fresh id", () => {
		const p = Person.named("Eirlys");
		expect(p.name).toBe("Eirlys");
		expect(p.id).toBeTruthy();
		expect(p.home).toBe("");
	});
});

describe("Person#bareName", () => {
	it("is the name as printed when there is no parenthetical", () => {
		expect(Person.named("Cadoc").bareName).toBe("Cadoc");
	});

	// The roster writes pronouns beside the name; the book's lists print names alone, so matching one
	// against the other has to drop the parenthetical or nothing would ever read as used.
	it("drops a trailing parenthetical", () => {
		expect(Person.named("Bryn (she/her)").bareName).toBe("Bryn");
	});

	it("is empty for an unnamed row", () => {
		expect(Person.blank().bareName).toBe("");
	});
});

describe("Person#withTraitAdded", () => {
	it("sets the traits outright when the row has none", () => {
		expect(Person.blank().withTraitAdded("cheery").traits).toBe("cheery");
	});

	it("appends to what is already written, comma-separated", () => {
		const p = Person.blank().withTraitAdded("cheery");
		expect(p.withTraitAdded("all thumbs").traits).toBe("cheery, all thumbs");
	});

	it("does not repeat a trait the row already carries, whatever its case", () => {
		const p = Person.blank().withTraitAdded("cheery");
		expect(p.withTraitAdded("Cheery").traits).toBe("cheery");
	});

	it("ignores a blank trait", () => {
		expect(Person.blank().withTraitAdded("   ").traits).toBe("");
	});

	it("does not double the comma after a trailing one", () => {
		const p = Person.fromRaw({ id: "a", traits: "cheery," });
		expect(p.withTraitAdded("mute").traits).toBe("cheery, mute");
	});

	it("preserves the other fields", () => {
		const p = Person.fromRaw({ id: "a", name: "Bryn", home: "Marshedge" });
		const added = p.withTraitAdded("cheery");
		expect(added.name).toBe("Bryn");
		expect(added.home).toBe("Marshedge");
	});
});

describe("Person.hasTrait", () => {
	const withTraits = traits => Person.fromRaw({ id: "a", name: "Bryn", traits });

	// The whole point: the cell is free text, and what separates the traits in it is whatever the
	// table happened to type. All of these say the same two things.
	it.each(["cheery mute", "cheery, mute", "cheery; mute", "cheery\nmute", "Cheery. Mute."])(
		"reads both traits out of %j", written => {
			const p = withTraits(written);
			expect(p.hasTrait("cheery")).toBe(true);
			expect(p.hasTrait("mute")).toBe(true);
		});

	it("finds a trait written inside a sentence", () => {
		expect(withTraits("cheery and knows all the gossip").hasTrait("knows all the gossip")).toBe(true);
	});

	it("reads past a spelling of the separators inside the trait itself", () => {
		expect(withTraits("eagle eye").hasTrait("eagle-eye")).toBe(true);
	});

	it("does not find a trait nobody wrote", () => {
		expect(withTraits("cheery").hasTrait("mute")).toBe(false);
	});

	it("is false for a blank trait", () => {
		expect(withTraits("cheery").hasTrait("")).toBe(false);
	});

	it("is false on a row with no traits", () => {
		expect(withTraits("").hasTrait("cheery")).toBe(false);
	});
});

describe("Person.hasName", () => {
	const named = name => Person.fromRaw({ id: "a", name });

	it("ignores case and punctuation", () => {
		expect(named("Bryn,").hasName("bryn")).toBe(true);
	});

	it("looks past the parenthetical a row carries", () => {
		expect(named("Bryn (she/her)").hasName("Bryn")).toBe(true);
	});

	// Unlike a trait: a name cell holds one name, so containment is not a match.
	it("is false when the row merely contains the name", () => {
		expect(named("Bryn the Baker").hasName("Bryn")).toBe(false);
	});

	it("is false for a different name", () => {
		expect(named("Bryn").hasName("Cadoc")).toBe(false);
	});

	it("is false on a nameless row", () => {
		expect(named("").hasName("Bryn")).toBe(false);
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

	// A DEFAULT, not an override: a name clicked off Marshedge's list says where it comes from, which
	// is worth writing down for someone whose row says nothing yet and worth nothing against someone
	// the table has already placed.
	it("withHomeIfUnset fills a blank home", () => {
		expect(Person.named("Seadha").withHomeIfUnset("Marshedge").home).toBe("Marshedge");
	});

	it("withHomeIfUnset leaves a home somebody already wrote", () => {
		const placed = Person.named("Seadha").withHome("Lygos");
		expect(placed.withHomeIfUnset("Marshedge").home).toBe("Lygos");
	});

	// Blank means THIS steading, which is a home like any other — the steading's own name list sends
	// no home precisely because a blank one already says it.
	it("withHomeIfUnset ignores a blank home", () => {
		expect(Person.named("Bryn").withHomeIfUnset("").home).toBe("");
		expect(Person.named("Bryn").withHomeIfUnset("   ").home).toBe("");
	});

	it("withHomeIfUnset returns the same person when there is nothing to write", () => {
		const p = Person.named("Bryn");
		expect(p.withHomeIfUnset("")).toBe(p);
	});

	it("withHome returns a new Person with the updated home", () => {
		const p = Person.blank();
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
	it("round-trips someone with no home written down", () => {
		const p = Person.fromRaw({id: "abc", name: "Aldric", occupation: "Smith", traits: "Gruff"});
		expect(p.id).toBe("abc");
		expect(p.name).toBe("Aldric");
		expect(p.occupation).toBe("Smith");
		expect(p.traits).toBe("Gruff");
		expect(p.home).toBe("");
	});

	it("round-trips someone who lives elsewhere", () => {
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
		expect(p.home).toBe("");
	});

	// fromRaw runs on every read of the stored list, so minting an id here would hand the same person
	// a new identity on every render — and the sheet addresses rows by id.
	it("leaves an absent id absent rather than minting one", () => {
		expect(Person.fromRaw({name: "Aldric"}).id).toBeUndefined();
	});
});
