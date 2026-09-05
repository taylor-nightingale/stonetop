import { describe, it, expect } from "vitest";
import { FolkSuggestions } from "../../../src/actors/steading/FolkSuggestions.js";
import { Folk } from "../../../src/actors/steading/Folk.js";
import { SuggestionList } from "../../../src/model/snapshot/steading/SuggestionSnapshot.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";

function make({ names = "", traits = [], places = [] } = {}) {
	const actor = new FakeActorBuilder()
		.withName("Stonetop")
		.withSystem({ residents: { names, traits }, neighborPlaces: places, folk: [] })
		.build();
	const folk = new Folk(actor);
	return { actor, folk, suggestions: new FolkSuggestions(actor, folk) };
}

const titles = lists => lists.map(l => l.title);
const labels = list => list.entries.map(e => e.label);

describe("FolkSuggestions.build", () => {
	it("leads with the steading's own names", () => {
		const { suggestions } = make({ names: "Bryn, Cadoc" });
		expect(labels(suggestions.build()[0])).toEqual(["Bryn", "Cadoc"]);
	});

	it("names each list after the place it belongs to", () => {
		const { suggestions } = make({
			names: "Bryn",
			places: [{ slug: "marshedge", name: "Marshedge", names: "Seadha" }],
		});
		expect(titles(suggestions.build())).toEqual(["Names — Stonetop", "Names — Marshedge"]);
	});

	// A name carries its list's place with it, so the roster's Home column is filled by the same
	// click that fills the Name column.
	it("gives a neighbouring place's list that place as its home", () => {
		const { suggestions } = make({
			places: [{ slug: "marshedge", name: "Marshedge", names: "Seadha" }],
		});
		expect(suggestions.build()[0].home).toBe("Marshedge");
	});

	// A blank Home means THIS steading, so the steading's own names send none: writing the steading's
	// own name into every resident's row would undo the merge of residents and neighbours a row at a
	// time.
	it("sends no home with the steading's own names", () => {
		const { suggestions } = make({ names: "Bryn" });
		expect(suggestions.build()[0].home).toBe("");
	});

	it("sends no home with the traits, which belong to nowhere", () => {
		const { suggestions } = make({ traits: ["gruff"] });
		expect(suggestions.build()[0].home).toBe("");
	});

	// The key identifies a list to the one thing outside its own DOM that addresses it: the record of
	// which lists this reader has folded away. Stable across renders, and unique on the tab.
	it("keys each list distinctly", () => {
		const { suggestions } = make({
			names: "Bryn",
			traits: ["gruff"],
			places: [
				{ slug: "marshedge", name: "Marshedge", names: "Seadha" },
				{ slug: "lygos",     name: "Lygos",     names: "Agatte" },
			],
		});
		const keys = suggestions.build().map(l => l.key);
		expect(keys).toEqual(["names-own", "names-marshedge", "names-lygos", "traits"]);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("follows the steadfast's order for the neighbouring places", () => {
		const { suggestions } = make({
			places: [
				{ slug: "marshedge", name: "Marshedge", names: "Seadha" },
				{ slug: "lygos",     name: "Lygos",     names: "Agatte" },
			],
		});
		expect(titles(suggestions.build())).toEqual(["Names — Marshedge", "Names — Lygos"]);
	});

	it("drops a place that seeds no names rather than printing an empty heading", () => {
		const { suggestions } = make({
			names: "Bryn",
			places: [{ slug: "other", name: "Other places", names: "" }],
		});
		expect(titles(suggestions.build())).toEqual(["Names — Stonetop"]);
	});

	it("ends with the trait pool, which needs no tokenising", () => {
		const { suggestions } = make({ traits: ["cheery", "all thumbs"] });
		const [list] = suggestions.build();
		expect(list.kind).toBe(SuggestionList.TRAIT);
		expect(labels(list)).toEqual(["cheery", "all thumbs"]);
	});

	it("gives a name list the name action and a trait list the trait one", () => {
		const { suggestions } = make({ names: "Bryn", traits: ["cheery"] });
		expect(suggestions.build().map(l => l.action)).toEqual(["useName", "useTrait"]);
	});

	it("is empty when the steading seeds no pools at all", () => {
		expect(make().suggestions.build()).toEqual([]);
	});
});

// Which lists arrive open. The reference column is several screens of names, and all but one of its
// pools are places most villagers are not from — so the one you reach for is in front of you and the
// rest are a title. Which is which is this class's knowledge; SuggestionList only carries it.
describe("FolkSuggestions — how the lists arrive", () => {
	it("opens the steading's own names", () => {
		const { suggestions } = make({ names: "Bryn" });
		expect(suggestions.build()[0].open).toBe(true);
	});

	it("folds each neighbouring place's names away", () => {
		const { suggestions } = make({
			names: "Bryn",
			places: [
				{ slug: "marshedge", name: "Marshedge", names: "Seadha" },
				{ slug: "lygos",     name: "Lygos",     names: "Agatte" },
			],
		});
		expect(suggestions.build().map(l => l.open)).toEqual([true, false, false]);
	});

	// The pool you scan while writing traits, not a place — it stays open with the steading's own.
	it("opens the trait pool", () => {
		const { suggestions } = make({ traits: ["cheery"] });
		expect(suggestions.build()[0].open).toBe(true);
	});
});

describe("FolkSuggestions — what the roster already uses", () => {
	it("marks a name somebody on the roster goes by", async () => {
		const { folk, suggestions } = make({ names: "Bryn, Cadoc" });
		await folk.addNamed("Bryn (she/her)");
		expect(suggestions.build()[0].entries.map(e => e.used)).toEqual([true, false]);
	});

	it("marks a used name in a neighbouring place's list too", async () => {
		const { folk, suggestions } = make({
			places: [{ slug: "marshedge", name: "Marshedge", names: "Seadha, Brogan" }],
		});
		await folk.addNamed("Seadha");
		expect(suggestions.build()[0].entries.map(e => e.used)).toEqual([true, false]);
	});

	it("marks a trait already written on somebody's row", async () => {
		const { folk, suggestions } = make({ traits: ["cheery", "all thumbs"] });
		const person = await folk.addNamed("Bryn");
		await folk.appendTrait(person.id, "cheery");
		expect(suggestions.build()[0].entries.map(e => e.used)).toEqual([true, false]);
	});

	// Dimmed, never removed: repeating a trait is sometimes exactly right, and the scan has to stay
	// whole for the list to be worth reading down.
	it("keeps a used entry in the list", async () => {
		const { folk, suggestions } = make({ names: "Bryn, Cadoc" });
		await folk.addNamed("Bryn");
		expect(labels(suggestions.build()[0])).toEqual(["Bryn", "Cadoc"]);
	});
});
