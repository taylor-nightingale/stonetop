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
