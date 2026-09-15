import { describe, it, expect } from "vitest";
import { Folk } from "../../../src/actors/steading/Folk.js";
import { Person } from "../../../src/actors/steading/Person.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { FakeNpcRepository } from "../../fakes/FakeNpcRepository.js";

function make(npcs = null) {
	return new Folk(new FakeActorBuilder().withName("Stonetop").build(), npcs);
}

/** The roster with one blank row already on it, and that row's id. */
async function withOne(npcs = null) {
	const folk = make(npcs);
	await folk.add();
	return { folk, id: folk.buildSnapshot()[0].id };
}

describe("Folk.add", () => {
	it("creates a Person carrying a blank home — which means this steading", async () => {
		const { folk } = await withOne();
		expect(folk.buildSnapshot()[0]).toBeInstanceOf(Person);
		expect(folk.buildSnapshot()[0].home).toBe("");
	});

	it("creates blank name, occupation, traits", async () => {
		const { folk } = await withOne();
		const p = folk.buildSnapshot()[0];
		expect(p.name).toBe("");
		expect(p.occupation).toBe("");
		expect(p.traits).toBe("");
	});
});

describe("Folk.addNamed", () => {
	it("adds someone already carrying that name", async () => {
		const folk = make();
		await folk.addNamed("Eirlys");
		expect(folk.buildSnapshot()[0].name).toBe("Eirlys");
	});

	// The sheet points the caret at whoever it just made, so it needs to be told who that is.
	it("hands back the person it added", async () => {
		const folk = make();
		const person = await folk.addNamed("Eirlys");
		expect(person.id).toBe(folk.buildSnapshot()[0].id);
	});

	// A name off a neighbouring place's list arrives already knowing where it is from.
	it("adds them at the home the name's list belongs to", async () => {
		const folk = make();
		await folk.addNamed("Seadha", "Marshedge");
		expect(folk.buildSnapshot()[0].home).toBe("Marshedge");
	});

	it("adds them with a blank home when the list names no place", async () => {
		const folk = make();
		await folk.addNamed("Eirlys");
		expect(folk.buildSnapshot()[0].home).toBe("");
	});
});

// One gesture — "use this name, off this list" — rather than a name write and a home write the
// caller has to remember to pair up.
describe("Folk.useName", () => {
	it("writes the name onto the row", async () => {
		const { folk, id } = await withOne();
		await folk.useName(id, "Seadha");
		expect(folk.buildSnapshot()[0].name).toBe("Seadha");
	});

	it("fills a blank home with the place the name came from", async () => {
		const { folk, id } = await withOne();
		await folk.useName(id, "Seadha", "Marshedge");
		expect(folk.buildSnapshot()[0].home).toBe("Marshedge");
	});

	it("leaves a home somebody already wrote", async () => {
		const { folk, id } = await withOne();
		await folk.updateHome(id, "Lygos");
		await folk.useName(id, "Seadha", "Marshedge");
		expect(folk.buildSnapshot()[0]).toMatchObject({ name: "Seadha", home: "Lygos" });
	});

	it("leaves the home alone for a name off the steading's own list", async () => {
		const { folk, id } = await withOne();
		await folk.useName(id, "Bryn");
		expect(folk.buildSnapshot()[0].home).toBe("");
	});

	it("does nothing for an id that is not on the roster", async () => {
		const { folk } = await withOne();
		await folk.useName("nobody", "Seadha", "Marshedge");
		expect(folk.buildSnapshot()[0].name).not.toBe("Seadha");
	});
});

describe("Folk.remove", () => {
	it("removes by id", async () => {
		const { folk, id } = await withOne();
		await folk.remove(id);
		expect(folk.buildSnapshot()).toHaveLength(0);
	});
});

describe("Folk — named update methods", () => {
	it("updateName updates the name and preserves the other fields", async () => {
		const { folk, id } = await withOne();
		await folk.updateName(id, "Aldric");
		const p = folk.buildSnapshot()[0];
		expect(p.name).toBe("Aldric");
		expect(p.occupation).toBe("");
		expect(p.home).toBe("");
	});

	it("updateOccupation updates the occupation", async () => {
		const { folk, id } = await withOne();
		await folk.updateOccupation(id, "Blacksmith");
		expect(folk.buildSnapshot()[0].occupation).toBe("Blacksmith");
	});

	it("updateTraits updates the traits", async () => {
		const { folk, id } = await withOne();
		await folk.updateTraits(id, "Gruff but reliable");
		expect(folk.buildSnapshot()[0].traits).toBe("Gruff but reliable");
	});

	it("updateHome updates where they live", async () => {
		const { folk, id } = await withOne();
		await folk.updateHome(id, "Marshedge");
		expect(folk.buildSnapshot()[0].home).toBe("Marshedge");
	});

	it("appendTrait adds to what is already written", async () => {
		const { folk, id } = await withOne();
		await folk.appendTrait(id, "cheery");
		await folk.appendTrait(id, "all thumbs");
		expect(folk.buildSnapshot()[0].traits).toBe("cheery, all thumbs");
	});

	// A row can be deleted by another client between a render and a click on it.
	it("leaves the roster alone when the id names nobody", async () => {
		const { folk } = await withOne();
		await folk.updateName("gone", "Aldric");
		expect(folk.buildSnapshot()[0].name).toBe("");
	});
});

describe("Folk — document linking", () => {
	it("linkDocument stores the uuid on the person", async () => {
		const { folk, id } = await withOne();
		await folk.linkDocument(id, "Actor.xyz");
		expect(folk.buildSnapshot()[0].linkUuid).toBe("Actor.xyz");
	});

	it("buildSnapshot exposes a docLink @UUID token for a linked row", async () => {
		const { folk, id } = await withOne();
		await folk.linkDocument(id, "JournalEntry.j1");
		expect(folk.buildSnapshot()[0].docLink.raw).toBe("@UUID[JournalEntry.j1]");
	});

	it("an unlinked row has no docLink", async () => {
		const { folk } = await withOne();
		expect(folk.buildSnapshot()[0].docLink).toBeUndefined();
	});

	it("unlinkDocument clears the link and keeps the row", async () => {
		const { folk, id } = await withOne();
		await folk.updateName(id, "Aldric");
		await folk.linkDocument(id, "Actor.xyz");
		await folk.unlinkDocument(id);
		expect("linkUuid" in folk.buildSnapshot()[0]).toBe(false);
		expect(folk.buildSnapshot()[0].name).toBe("Aldric");
	});

	it("linksDocument answers for any row", async () => {
		const { folk, id } = await withOne();
		await folk.linkDocument(id, "Actor.xyz");
		expect(folk.linksDocument("Actor.xyz")).toBe(true);
		expect(folk.linksDocument("Actor.other")).toBe(false);
	});
});

// What the reference lists ask, to know which entries to dim.
describe("Folk.usesName", () => {
	it("is true for a name someone on the roster goes by", async () => {
		const { folk, id } = await withOne();
		await folk.updateName(id, "Bryn");
		expect(folk.usesName("Bryn")).toBe(true);
	});

	it("ignores case", async () => {
		const { folk, id } = await withOne();
		await folk.updateName(id, "bryn");
		expect(folk.usesName("Bryn")).toBe(true);
	});

	it("matches past the pronouns written beside the name", async () => {
		const { folk, id } = await withOne();
		await folk.updateName(id, "Bryn (she/her)");
		expect(folk.usesName("Bryn")).toBe(true);
	});

	it("ignores the punctuation a hurried row carries", async () => {
		const { folk, id } = await withOne();
		await folk.updateName(id, "Bryn,");
		expect(folk.usesName("Bryn")).toBe(true);
	});

	it("is false for a name nobody has", async () => {
		const { folk, id } = await withOne();
		await folk.updateName(id, "Bryn");
		expect(folk.usesName("Cadoc")).toBe(false);
	});

	// Every unnamed row would otherwise match the blank, and the whole list would dim at once.
	it("is false for a blank name", async () => {
		const { folk } = await withOne();
		expect(folk.usesName("")).toBe(false);
	});
});

describe("Folk.usesTrait", () => {
	it("is true for a trait written on somebody's row", async () => {
		const { folk, id } = await withOne();
		await folk.updateTraits(id, "cheery, all thumbs");
		expect(folk.usesTrait("all thumbs")).toBe(true);
	});

	it("ignores case", async () => {
		const { folk, id } = await withOne();
		await folk.updateTraits(id, "Cheery");
		expect(folk.usesTrait("cheery")).toBe(true);
	});

	// The reported bug: the traits cell is one free-text textarea and tables write into it by hand,
	// separating what they write with spaces, semicolons, newlines — whatever reads well. Nothing
	// here is cut on a separator, so all of these are read the same way.
	it.each([
		["spaces",     "cheery mute"],
		["semicolons", "cheery; mute"],
		["newlines",   "cheery\nmute"],
		["commas",     "cheery, mute"],
		["sentences",  "Cheery. Mute."],
		["bullets",    "- cheery\n- mute"],
	])("reads a row whose traits are separated by %s", async (_, written) => {
		const { folk, id } = await withOne();
		await folk.updateTraits(id, written);
		expect(folk.usesTrait("cheery")).toBe(true);
		expect(folk.usesTrait("mute")).toBe(true);
	});

	it("finds a trait written into a sentence", async () => {
		const { folk, id } = await withOne();
		await folk.updateTraits(id, "cheery, but knows all the gossip");
		expect(folk.usesTrait("knows all the gossip")).toBe(true);
	});

	it("reads a hand-typed trait against the pool's own spelling of it", async () => {
		const { folk, id } = await withOne();
		await folk.updateTraits(id, "eagle eye");
		expect(folk.usesTrait("eagle-eye")).toBe(true);
	});

	// The cost of reading a cell as a sentence, which is the only way a space-separated one can be
	// read: a short trait inside a longer phrase counts as written. Stated so a change to it is
	// deliberate rather than a surprise.
	it("counts a short trait contained in a longer phrase", async () => {
		const { folk, id } = await withOne();
		await folk.updateTraits(id, "immaculate appearance");
		expect(folk.usesTrait("immaculate")).toBe(true);
	});

	it("still matches whole phrases, not pieces of words", async () => {
		const { folk, id } = await withOne();
		await folk.updateTraits(id, "commutes to Marshedge");
		expect(folk.usesTrait("mute")).toBe(false);
	});

	it("finds a trait written on any row, not only the first", async () => {
		const { folk } = await withOne();
		await folk.addNamed("Cadoc");
		const second = folk.buildSnapshot()[1].id;
		await folk.updateTraits(second, "drunkard");
		expect(folk.usesTrait("drunkard")).toBe(true);
	});

	it("is false for a trait nobody wrote", async () => {
		const { folk, id } = await withOne();
		await folk.updateTraits(id, "cheery");
		expect(folk.usesTrait("mute")).toBe(false);
	});

	it("is false for a blank trait", async () => {
		const { folk } = await withOne();
		expect(folk.usesTrait("")).toBe(false);
	});
});

// The whole point of the merge: one rule for where somebody's actor is filed. A blank home is not
// "unknown" — it is this steading.
describe("Folk — where an NPC actor is filed", () => {
	it("files someone with no home written down under the steading's own name", async () => {
		const repo = new FakeNpcRepository();
		const { folk, id } = await withOne(repo);
		await folk.updateName(id, "Bryn");
		await folk.syncActors();
		expect(repo.created[0].folderId).toBe("folder-Stonetop");
	});

	it("files someone with a home under that home", async () => {
		const repo = new FakeNpcRepository();
		const { folk, id } = await withOne(repo);
		await folk.updateName(id, "Seadha");
		await folk.updateHome(id, "Marshedge");
		await folk.syncActors();
		expect(repo.created[0].folderId).toBe("folder-Marshedge");
	});

	it("treats whitespace as no home at all", async () => {
		const repo = new FakeNpcRepository();
		const { folk, id } = await withOne(repo);
		await folk.updateName(id, "Bryn");
		await folk.updateHome(id, "   ");
		await folk.syncActors();
		expect(repo.created[0].folderId).toBe("folder-Stonetop");
	});

	it("writes the created actor's uuid back onto the row", async () => {
		const repo = new FakeNpcRepository();
		const { folk, id } = await withOne(repo);
		await folk.updateName(id, "Bryn");
		await folk.syncActors();
		expect(folk.buildSnapshot()[0].linkUuid).toBeTruthy();
	});

	it("syncs only the rows named in the delta", async () => {
		const repo = new FakeNpcRepository();
		const folk = make(repo);
		await folk.addNamed("Bryn");
		await folk.addNamed("Cadoc");
		await folk.syncActors([folk.buildSnapshot()[1].id]);
		expect(repo.created.map(d => d.name)).toEqual(["Cadoc"]);
	});

	it("previewActors reports the location each row would be filed under", async () => {
		const folk = make(new FakeNpcRepository());
		await folk.addNamed("Bryn");
		await folk.updateHome(folk.buildSnapshot()[0].id, "Marshedge");
		const [plan] = await folk.previewActors();
		expect(plan.location).toBe("Marshedge");
	});

	it("does nothing at all without an NPC repository", async () => {
		const { folk, id } = await withOne();
		await folk.updateName(id, "Bryn");
		await folk.syncActors();
		expect(folk.buildSnapshot()[0].linkUuid).toBeUndefined();
		expect(await folk.previewActors()).toEqual([]);
	});
});
