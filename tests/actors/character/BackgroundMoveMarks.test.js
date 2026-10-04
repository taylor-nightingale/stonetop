import { describe, it, expect } from "vitest";
import { BackgroundMoveMarks } from "../../../src/actors/character/BackgroundMoveMarks.js";
import { CharacterBackgrounds } from "../../../src/actors/character/CharacterBackgrounds.js";
import { MovePicks } from "../../../src/actors/character/MovePicks.js";
import { ChoiceGroupControllerFactory } from "../../../src/actors/character/ChoiceGroupControllerFactory.js";
import { ResourceController } from "../../../src/actors/character/ResourceController.js";
import { Background } from "../../../src/model/data/character/Background.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeCompendiumMoveBuilder } from "../../fakes/FakeCompendiumMoveBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";

const TOPICS = { slug: "topics", list: ["fae", "makers", "things-below", "last-door"].map(slug => (
	{ type: "entry", slug, track: { max: 1 }, content: { title: null, text: slug } }
)) };

const PATRIOT      = { slug: "patriot",      moveMarks: [{ move: "well-versed", group: "topics", options: ["things-below"] }] };
const ANTIQUARIAN  = { slug: "antiquarian",  moveMarks: [{ move: "well-versed", group: "topics", options: ["makers"] }] };
const WITCH_HUNTER = { slug: "witch-hunter", moveMarks: [{ move: "well-versed", group: "topics", options: ["fae", "things-below", "last-door"] }] };
const BACKGROUNDS  = [PATRIOT, ANTIQUARIAN, WITCH_HUNTER];

function wellVersed(pickValues = {}) {
	const move = new FakeCompendiumMoveBuilder().withName("Well Versed").withChoices(TOPICS).build();
	return { ...move, _id: "wv", system: { ...move.system, pickValues } };
}

function setup({ selected = "", backgroundValues = {}, pickValues = {}, ownsMove = true } = {}) {
	const playbook = { _id: "pb", type: "playbook", name: "The Seeker",
		system: { slug: "the-seeker", backgrounds: BACKGROUNDS, backgroundValues } };
	const actor = new FakeCharacterActorBuilder()
		.withBackground(selected)
		.withItems([playbook, ...(ownsMove ? [wellVersed(pickValues)] : [])])
		.build();
	const factory     = new ChoiceGroupControllerFactory(actor);
	const picks       = new MovePicks(actor, factory, new FakeMoveRepository());
	const backgrounds = new CharacterBackgrounds(actor, factory, new ResourceController(actor), picks);
	const marks       = new BackgroundMoveMarks(picks, backgrounds);
	factory.subscribe(marks);
	return { actor, marks, backgrounds, topics: () => actor.items.get("wv")?.system.pickValues.topics ?? {} };
}

const bg = def => Background.of(def);

describe("BackgroundMoveMarks#switchBetween", () => {
	it("marks the topic a fixed background names", async () => {
		const { marks, topics } = setup();
		await marks.switchBetween(null, bg(PATRIOT));
		expect(topics()).toEqual({ "things-below": 1 });
	});

	it("moves the mark from the old background's topic to the new one's", async () => {
		const { marks, topics } = setup({ pickValues: { topics: { "things-below": 1 } } });
		await marks.switchBetween(bg(PATRIOT), bg(ANTIQUARIAN));
		expect(topics()).toEqual({ "things-below": 0, makers: 1 });
	});

	it("marks the topic already picked for a background with a choice", async () => {
		const { marks, topics } = setup({ backgroundValues: { "witch-hunter-well-versed": { fae: 1 } } });
		await marks.switchBetween(null, bg(WITCH_HUNTER));
		expect(topics()).toEqual({ fae: 1 });
	});

	it("marks nothing for a background whose topic has not been picked yet", async () => {
		const { marks, topics } = setup();
		await marks.switchBetween(null, bg(WITCH_HUNTER));
		expect(topics()).toEqual({});
	});

	it("keeps a topic the old and new backgrounds share", async () => {
		const { marks, topics } = setup({
			backgroundValues: { "witch-hunter-well-versed": { "things-below": 1 } },
			pickValues:       { topics: { "things-below": 1 } },
		});
		await marks.switchBetween(bg(PATRIOT), bg(WITCH_HUNTER));
		expect(topics()).toEqual({ "things-below": 1 });
	});

	it("does nothing when the character does not own the move", async () => {
		const { marks, actor } = setup({ ownsMove: false });
		await marks.switchBetween(null, bg(PATRIOT));
		expect([...actor.items].some(i => i.type === "move")).toBe(false);
	});
});

describe("BackgroundMoveMarks#handle — picking a topic on the background", () => {
	it("marks the picked topic when the background is the chosen one", async () => {
		const { backgrounds, topics } = setup({ selected: "witch-hunter" });
		await backgrounds.controller().selectOption("witch-hunter-well-versed", "fae", "fae,things-below,last-door");
		expect(topics()).toEqual({ fae: 1 });
	});

	it("moves the mark when the pick changes", async () => {
		const { backgrounds, topics } = setup({ selected: "witch-hunter" });
		const siblings = "fae,things-below,last-door";
		await backgrounds.controller().selectOption("witch-hunter-well-versed", "fae", siblings);
		await backgrounds.controller().selectOption("witch-hunter-well-versed", "last-door", siblings);
		expect(topics()).toEqual({ fae: 0, "last-door": 1 });
	});

	// Every background's pick is on screen while choosing; picking on one not yet chosen only
	// records it, and choosing the background is what marks it.
	it("only records a pick made on a background that is not the chosen one", async () => {
		const { backgrounds, topics } = setup({ selected: "patriot" });
		await backgrounds.controller().selectOption("witch-hunter-well-versed", "fae", "fae,things-below,last-door");
		expect(topics()).toEqual({});
	});

	it("ignores the background's other choices", async () => {
		const { backgrounds, topics } = setup({ selected: "witch-hunter" });
		await backgrounds.controller().setCount("witch-hunter", "fae", 1);
		expect(topics()).toEqual({});
	});
});

describe("BackgroundMoveMarks#ensureMarked", () => {
	it("marks the background's topic when it is unmarked", async () => {
		const { marks, topics } = setup();
		expect(await marks.ensureMarked(bg(PATRIOT))).toBe(1);
		expect(topics()).toEqual({ "things-below": 1 });
	});

	it("leaves a topic already marked alone, and reports nothing done", async () => {
		const { marks, topics } = setup({ pickValues: { topics: { "things-below": 1 } } });
		expect(await marks.ensureMarked(bg(PATRIOT))).toBe(0);
		expect(topics()).toEqual({ "things-below": 1 });
	});

	it("never un-marks anything", async () => {
		const { marks, topics } = setup({ pickValues: { topics: { makers: 1 } } });
		await marks.ensureMarked(bg(PATRIOT));
		expect(topics()).toEqual({ makers: 1, "things-below": 1 });
	});
});
