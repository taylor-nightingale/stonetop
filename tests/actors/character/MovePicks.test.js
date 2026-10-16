import { describe, it, expect } from "vitest";
import { MovePicks } from "../../../src/actors/character/MovePicks.js";
import { ChoiceGroupControllerFactory } from "../../../src/actors/character/ChoiceGroupControllerFactory.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeCompendiumMoveBuilder } from "../../fakes/FakeCompendiumMoveBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";

const TOPICS = { slug: "topics", list: [
	{ type: "entry", slug: "fae", track: { max: 1 }, content: { title: null, text: "The Fae" } },
] };

function wellVersed(pickValues = {}) {
	const move = new FakeCompendiumMoveBuilder().withName("Well Versed").withChoices(TOPICS).build();
	return { ...move, _id: "wv", system: { ...move.system, pickValues } };
}

function makePicks(items = [], repo = new FakeMoveRepository()) {
	const actor = new FakeCharacterActorBuilder().withItems(items).build();
	return { picks: new MovePicks(actor, new ChoiceGroupControllerFactory(actor), repo), actor };
}

describe("MovePicks#controllerFor", () => {
	it("writes the owned move's pick values", async () => {
		const { picks, actor } = makePicks([wellVersed()]);
		await picks.controllerFor("well-versed").setCount("topics", "fae", 1);
		expect(actor.items.get("wv").system.pickValues).toEqual({ topics: { fae: 1 } });
	});

	it("is null for a move the character does not own", () => {
		expect(makePicks().picks.controllerFor("well-versed")).toBeNull();
	});

	it("is null for an owned move with no choice group", () => {
		const plain = { ...new FakeCompendiumMoveBuilder().withName("Polyglot").build(), _id: "pg" };
		expect(makePicks([plain]).picks.controllerFor("polyglot")).toBeNull();
	});
});

describe("MovePicks#countOf", () => {
	it("reads the owned move's count for one option", () => {
		const { picks } = makePicks([wellVersed({ topics: { fae: 1 } })]);
		expect(picks.countOf("well-versed", "topics", "fae")).toBe(1);
	});

	it("is 0 for an option never marked, and for a move not owned", () => {
		expect(makePicks([wellVersed()]).picks.countOf("well-versed", "topics", "fae")).toBe(0);
		expect(makePicks().picks.countOf("well-versed", "topics", "fae")).toBe(0);
	});
});

describe("MovePicks#choicesOf", () => {
	it("is the owned move's choice group", async () => {
		const { picks } = makePicks([wellVersed()]);
		expect(await picks.choicesOf("well-versed")).toEqual(TOPICS);
	});

	// A background is read while it is being chosen, so the options it offers have to show even
	// when the character has dropped the move.
	it("falls back to the catalog's copy when the character does not own the move", async () => {
		const repo = new FakeMoveRepository()
			.addPlaybook(new FakeCompendiumMoveBuilder().withName("Well Versed").withChoices(TOPICS).build());
		expect(await makePicks([], repo).picks.choicesOf("well-versed")).toEqual(TOPICS);
	});

	it("is null for a move nobody has", async () => {
		expect(await makePicks().picks.choicesOf("well-versed")).toBeNull();
	});
});
