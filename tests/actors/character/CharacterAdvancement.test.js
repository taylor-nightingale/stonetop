import { describe, it, expect } from "vitest";
import { CharacterAdvancement } from "../../../src/actors/character/CharacterAdvancement.js";
import { CharacterVitals } from "../../../src/actors/character/CharacterVitals.js";
import { CharacterPossessions } from "../../../src/actors/character/CharacterPossessions.js";
import { ChoiceGroupControllerFactory } from "../../../src/actors/character/ChoiceGroupControllerFactory.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeMoves } from "../../fakes/FakeMoves.js";
import { TestInsertItemBuilder } from "../../fakes/TestInsertItemBuilder.js";
import { TestPlaybookItemBuilder } from "../../fakes/TestPlaybookItemBuilder.js";

// The move as packs/src/moves/homefront/level-up.json carries it: six steps of pure structure, and
// the same six as bullets in the description, which is where their words come from. Written out
// rather than read off disk so a test failure says which STEP broke, not that a file changed.
const LEVEL_UP = {
	_id: "level-up-id",
	name: "Level Up",
	type: "move",
	system: {
		slug: "level-up",
		moveType: "homefront",
		description: "When you **_have a quiet stretch of time at home and XP equal to (or greater than) 6 + twice your current level_**, follow these steps:\n\n- Subtract 6 + twice your current level from your XP.\n- Increase your level by 1.\n- Choose a new move from your playbook, or an insert class that you've unlocked.\n- If you are the Blessed (or have a sacred pouch) and your new level is even, increase your maximum Stock by 1.\n- If you are the Lightbearer (or have Invoke the Sun God) and your new level is even, choose a new Invocation.\n- Review your Instinct and Appearance. Change anything that no longer applies. Feel free to make up new options.",
		steps: [
			{ kind: "spend" },
			{ kind: "advance" },
			{ kind: "chooseMove", tab: "moves" },
			{ kind: "stock", possession: "sacred-pouch" },
			{ kind: "invocation", insert: "lightbearer-invocations-insert",
			  group: "lightbearer-invocations", startsKnowing: 2 },
			{ kind: "review", tab: "playbook" },
		],
	},
};

const sacredPouch = (uses = {}) => ({
	_id: "sacred-pouch-item",
	type: "possession",
	name: "Sacred pouch",
	system: {
		slug: "sacred-pouch", selected: true, outfitItems: [], pickValues: {},
		resource: { max: 3, title: "Stock", labels: [] },
		scaling: { perEvenLevel: 1, perMove: [] },
		...uses,
	},
});

const invocationsInsert = (chosen = []) => new TestInsertItemBuilder()
	.withId("invocations-item")
	.withSlug("lightbearer-invocations-insert")
	.withName("Invocations")
	.withChoiceValues({ "lightbearer-invocations": Object.fromEntries(chosen.map(s => [s, 1])) })
	.build();

function makeAdvancement({ level = 1, xp = 0, items = [], moves = new FakeMoves(),
                          steps, description } = {}) {
	const actor  = new FakeCharacterActorBuilder().withLevel(level).withXp(xp, 8).withItems(items).build();
	const vitals = new CharacterVitals(actor);
	const possessions = new CharacterPossessions(
		actor, moves, null, new ChoiceGroupControllerFactory(actor), null);
	const system = { ...LEVEL_UP.system };
	if (steps !== undefined)       system.steps       = steps;
	if (description !== undefined) system.description = description;
	const repo = new FakeMoveRepository([], [{ ...LEVEL_UP, system }]);
	return { actor, vitals, advancement: new CharacterAdvancement(actor, vitals, moves, possessions, repo) };
}

const rowsOf = snapshot => snapshot.rows.map(row => row.kind);
const rowFor = (snapshot, kind) => snapshot.rows.find(row => row.kind === kind) ?? null;

describe("CharacterAdvancement.buildSnapshot", () => {
	it("reads the move's own steps in order", async () => {
		const { advancement } = makeAdvancement({ level: 5, xp: 19, items: [sacredPouch()] });
		const snapshot = await advancement.buildSnapshot();
		// The book's first two bullets are one act, so they are one row — see LevelUpProcedure.
		expect(rowsOf(snapshot)).toEqual(["advance", "chooseMove", "stock", "review"]);
	});

	it("lifts the move's trigger as the strip's one line of explanation", async () => {
		const { advancement } = makeAdvancement({ level: 5, xp: 19 });
		const snapshot = await advancement.buildSnapshot();
		expect(snapshot.gloss)
			.toBe("have a quiet stretch of time at home and XP equal to (or greater than) 6 + twice your current level");
	});

	it("renders nothing for a move that carries no procedure", async () => {
		const { advancement } = makeAdvancement({ level: 5, xp: 19, steps: [] });
		const snapshot = await advancement.buildSnapshot();
		expect(snapshot.rows).toEqual([]);
		expect(snapshot.isOffered).toBe(false);
	});

	it("renders nothing when the move is not in the catalog at all", async () => {
		const actor = new FakeCharacterActorBuilder().withLevel(5).withXp(19, 8).build();
		const vitals = new CharacterVitals(actor);
		const advancement = new CharacterAdvancement(
			actor, vitals, new FakeMoves(),
			new CharacterPossessions(actor, new FakeMoves(), null, new ChoiceGroupControllerFactory(actor), null),
			new FakeMoveRepository());
		const snapshot = await advancement.buildSnapshot();
		expect(snapshot.rows).toEqual([]);
	});

	it("carries the arithmetic onto the advance row", async () => {
		const { advancement } = makeAdvancement({ level: 5, xp: 19 });
		const row = rowFor(await advancement.buildSnapshot(), "advance");
		expect(row.cost).toBe(16);
		expect(row.xpBefore).toBe(19);
		expect(row.xpAfter).toBe(3);
		expect(row.to).toBe(6);
	});

	// The whole point of lifting them: `system.steps[].text` is a translatable path, and a second
	// copy of these sentences is a second thing to translate. See LevelUpProcedure.
	it("gives each row the move's own bullet, from the description", async () => {
		const { advancement } = makeAdvancement({ level: 5, xp: 19, items: [sacredPouch()] });
		const snapshot = await advancement.buildSnapshot();
		expect(rowFor(snapshot, "chooseMove").text.raw)
			.toBe("Choose a new move from your playbook, or an insert class that you've unlocked.");
		expect(rowFor(snapshot, "review").text.raw).toContain("Review your Instinct and Appearance.");
	});

	// The XP track prints 19 / 16 three lines above; the book states that threshold as a formula.
	it("names the advance row in the sheet's own words, not the book's formula", async () => {
		const { advancement } = makeAdvancement({ level: 5, xp: 19 });
		const row = rowFor(await advancement.buildSnapshot(), "advance");
		expect(row.labelKey).toBe("stonetop.character.levelUp.advanceStep");
		expect(row.text).toBeNull();
	});

	// A GM who edits a bullet out of the description shifts every step below it onto the wrong
	// sentence. Better a checklist with no words than one that misquotes the book.
	it("leaves the rows wordless when the description no longer matches the steps", async () => {
		const { advancement } = makeAdvancement({
			level: 5, xp: 19, description: "Follow these steps:\n\n- Only one bullet left.",
		});
		const row = rowFor(await advancement.buildSnapshot(), "chooseMove");
		expect(row.text).toBeNull();
		expect(row.tab).toBe("moves");   // still a working row, just not a misquoted one
	});

	it("is offered while the move has triggered", async () => {
		const { advancement } = makeAdvancement({ level: 5, xp: 16 });
		expect((await advancement.buildSnapshot()).isOffered).toBe(true);
	});

	it("says nothing at all when the XP is short and nothing is outstanding", async () => {
		const moves = new FakeMoves().withAcquiredMove("bolt-of-light", "playbook-the-lightbearer");
		const { advancement } = makeAdvancement({ level: 2, xp: 3, moves });
		expect((await advancement.buildSnapshot()).isOffered).toBe(false);
	});

	it("stays offered after the XP is spent, while a move is still to choose", async () => {
		const { advancement } = makeAdvancement({ level: 6, xp: 3 });
		const snapshot = await advancement.buildSnapshot();
		expect(snapshot.isReady).toBe(false);
		expect(snapshot.isOffered).toBe(true);
		expect(snapshot.owed.map(row => row.kind)).toEqual(["chooseMove"]);
	});
});

describe("CharacterAdvancement even-level clauses", () => {
	it("shows the Stock clause for a character who carries the pouch into an even level", async () => {
		const { advancement } = makeAdvancement({ level: 5, xp: 19, items: [sacredPouch()] });
		const stock = rowFor(await advancement.buildSnapshot(), "stock");
		expect(stock.from).toBe(5);  // 3 base + floor(5/2)
		expect(stock.to).toBe(6);    // 3 base + floor(6/2)
		expect(stock.changed).toBe(true);
	});

	it("drops the Stock clause for a character with no pouch", async () => {
		const { advancement } = makeAdvancement({ level: 5, xp: 19 });
		expect(rowFor(await advancement.buildSnapshot(), "stock")).toBeNull();
	});

	it("drops the Stock clause for a pouch that was never ticked", async () => {
		const unticked = sacredPouch();
		unticked.system.selected = false;
		const { advancement } = makeAdvancement({ level: 5, xp: 19, items: [unticked] });
		expect(rowFor(await advancement.buildSnapshot(), "stock")).toBeNull();
	});

	it("drops both even-level clauses when the level being bought is odd", async () => {
		const { advancement } = makeAdvancement({
			level: 6, xp: 18, items: [sacredPouch(), invocationsInsert()],
		});
		const snapshot = await advancement.buildSnapshot();
		expect(rowFor(snapshot, "stock")).toBeNull();
		expect(rowFor(snapshot, "invocation")).toBeNull();
	});

	it("counts the Invocations the insert actually has ticked", async () => {
		const insert = invocationsInsert(["blinding-light", "bath-of-healing-light", "shield-of-light"]);
		const { advancement } = makeAdvancement({ level: 5, xp: 19, items: [insert] });
		const row = rowFor(await advancement.buildSnapshot(), "invocation");
		expect(row.known).toBe(3);
		expect(row.expected).toBe(4);
		expect(row.tabLabel).toBe("Invocations");
	});

	it("drops the Invocation clause for a character without the insert", async () => {
		const { advancement } = makeAdvancement({ level: 5, xp: 19 });
		expect(rowFor(await advancement.buildSnapshot(), "invocation")).toBeNull();
	});
});

describe("CharacterAdvancement.chosenMoveCount", () => {
	const playbook = new TestPlaybookItemBuilder()
		.withSlug("the-blessed")
		.withStartingMoves(["spirit-taught", "call-the-spirits"])
		.build();

	it("counts a playbook move taken beyond the starting list", async () => {
		const moves = new FakeMoves()
			.withAcquiredMove("spirit-taught",  "playbook-the-blessed")
			.withAcquiredMove("call-the-spirits", "playbook-the-blessed")
			.withAcquiredMove("danus-grasp",    "playbook-the-blessed");
		const { advancement } = makeAdvancement({ items: [playbook], moves });
		expect(advancement.chosenMoveCount).toBe(1);
	});

	it("does not count the starting moves themselves", async () => {
		const moves = new FakeMoves()
			.withAcquiredMove("spirit-taught", "playbook-the-blessed")
			.withAcquiredMove("call-the-spirits", "playbook-the-blessed");
		const { advancement } = makeAdvancement({ items: [playbook], moves });
		expect(advancement.chosenMoveCount).toBe(0);
	});

	it("counts a repeatable move once per instance", async () => {
		const moves = new FakeMoves().withAcquiredMove("danus-grasp", "playbook-the-blessed", 3);
		const { advancement } = makeAdvancement({ items: [playbook], moves });
		expect(advancement.chosenMoveCount).toBe(3);
	});

	it("counts a second instance of a STARTING move as one purchase, not two", async () => {
		const moves = new FakeMoves().withAcquiredMove("spirit-taught", "playbook-the-blessed", 2);
		const { advancement } = makeAdvancement({ items: [playbook], moves });
		expect(advancement.chosenMoveCount).toBe(1);
	});

	it("counts an insert class's move beyond its own starting list", async () => {
		const insert = new TestInsertItemBuilder()
			.withSlug("revenant").withStartingMoves(["unquiet-spirit"]).build();
		const moves = new FakeMoves()
			.withAcquiredMove("unquiet-spirit", "insert-revenant")
			.withAcquiredMove("grave-cold",     "insert-revenant");
		const { advancement } = makeAdvancement({ items: [insert], moves });
		expect(advancement.chosenMoveCount).toBe(1);
	});

	it("ignores moves that were never a level's purchase", async () => {
		const moves = new FakeMoves()
			.withAcquiredMove("defy-danger",   "basic")
			.withAcquiredMove("hold-steady",   "special")
			.withAcquiredMove("wolf-pelt-move", "arcana-wolf-pelt")
			.withAcquiredMove("homesteader",   "background-homesteader");
		const { advancement } = makeAdvancement({ items: [playbook], moves });
		expect(advancement.chosenMoveCount).toBe(0);
	});
});

describe("CharacterAdvancement.advance", () => {
	it("spends the XP and takes the level in one write", async () => {
		const { actor, advancement } = makeAdvancement({ level: 5, xp: 19 });
		await advancement.advance();
		expect(actor.system.attributes.xp.value).toBe(3);
		expect(actor.system.attributes.level).toBe(6);
	});

	it("advances a character the table levelled early, flooring the track at zero", async () => {
		const { actor, advancement } = makeAdvancement({ level: 5, xp: 2 });
		await advancement.advance();
		expect(actor.system.attributes.xp.value).toBe(0);
		expect(actor.system.attributes.level).toBe(6);
	});

	it("leaves the strip agreeing with the new state", async () => {
		const { advancement } = makeAdvancement({ level: 5, xp: 19 });
		await advancement.advance();
		const snapshot = await advancement.buildSnapshot();
		expect(snapshot.isReady).toBe(false);
		expect(rowFor(snapshot, "advance").done).toBe(true);
		expect(rowFor(snapshot, "chooseMove").behind).toBe(5);
	});
});
