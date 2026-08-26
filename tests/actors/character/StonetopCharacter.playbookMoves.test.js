import {describe, it, expect, afterEach, vi} from "vitest";
import {StonetopCharacter} from "../../../src/actors/character/StonetopCharacter.js";
import {FoundryRepositoryFactory} from "../../../src/actors/character/repositories/FoundryRepositoryFactory.js";
import {StonetopPlaybook} from "../../../src/item/StonetopPlaybook.js";
import {FakeGameBuilder} from "../../fakes/FakeGameBuilder.js";
import {FakeCharacterActorBuilder} from "../../fakes/FakeCharacterActorBuilder.js";
import {FakePackBuilder} from "../../fakes/foundry/FakePackBuilder.js";
import {FakeCompendiumMoveBuilder} from "../../fakes/FakeCompendiumMoveBuilder.js";

// Integration test: real StonetopCharacter + real FoundryRepositoryFactory/repositories +
// real StonetopPlaybook. Only the Foundry boundary is faked (game.packs via FakeGameBuilder,
// the actor via FakeCharacterActorBuilder). This exercises the full drop→select→buildSnapshot wiring that
// unit tests (which mock the move repo) miss — e.g. StonetopPlaybook failing to surface `moves`.

// A dropped playbook item exposes asPlaybook() → StonetopPlaybook (the real domain wrapper).
function playbookItem(system = {}) {
	const item = {
		_id: "pb1", type: "playbook", name: "The Blessed",
		system: {
			slug: "the-blessed", startingMovesNote: null, backgrounds: [],
			followers: [], inserts: [], specialPossessions: null, ...system,
		},
		asPlaybook() { return new StonetopPlaybook(this); },
	};
	return item;
}

function withMovesPack(...moves) {
	const pack = FakePackBuilder.movesPack();
	for (const m of moves) pack.withItem(m);
	new FakeGameBuilder().withPack(pack).build();
}

function move(name) { return new FakeCompendiumMoveBuilder().withName(name).build(); }

describe("StonetopCharacter — playbook moves auto-populate on the moves tab (integration)", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("playbook moves appear in the moves tab after selecting a playbook", async () => {
		withMovesPack(move("Serenity"), move("Invoke the Gods"));
		const character = new StonetopCharacter(new FakeCharacterActorBuilder().build(), new FoundryRepositoryFactory());

		await character._onCreateDescendantDocuments([
			playbookItem({ moves: ["serenity", "invoke-the-gods"], startingMoves: ["serenity"] }),
		]);

		const cat = (await character.buildSnapshot()).moves.categories.find(c => c.key === "playbook-the-blessed");
		expect(cat).toBeDefined();
		expect(cat.moves.map(m => m.name).sort()).toEqual(["Invoke the Gods", "Serenity"]);
	});

	it("startingMoves seed acquired; the rest seed un-acquired", async () => {
		withMovesPack(move("Serenity"), move("Invoke the Gods"));
		const character = new StonetopCharacter(new FakeCharacterActorBuilder().build(), new FoundryRepositoryFactory());

		await character._onCreateDescendantDocuments([
			playbookItem({ moves: ["serenity", "invoke-the-gods"], startingMoves: ["serenity"] }),
		]);

		const cat = (await character.buildSnapshot()).moves.categories.find(c => c.key === "playbook-the-blessed");
		expect(cat.moves.find(m => m.name === "Serenity").selection.value).toBe(1);
		expect(cat.moves.find(m => m.name === "Invoke the Gods").selection.value).toBe(0);
	});

	// The playbook grant is a diff, not a rebuild: a move the playbook still lists is left as it is, so
	// the move a player advanced keeps its acquired state when the same playbook is applied again (a
	// re-drop, a re-pick from the dropdown, a migration re-run).
	it("re-applying the same playbook preserves a move the player acquired", async () => {
		withMovesPack(move("Serenity"), move("Invoke the Gods"));
		const character = new StonetopCharacter(new FakeCharacterActorBuilder().build(), new FoundryRepositoryFactory());
		const pb = () => playbookItem({ moves: ["serenity", "invoke-the-gods"], startingMoves: ["serenity"] });

		await character._onCreateDescendantDocuments([pb()]);
		await character.incrementMove("playbook-the-blessed", "invoke-the-gods");
		await character._onCreateDescendantDocuments([pb()]);

		const cat = (await character.buildSnapshot()).moves.categories.find(c => c.key === "playbook-the-blessed");
		expect(cat.moves.find(m => m.name === "Invoke the Gods").selection.value).toBe(1);
		expect(cat.moves.find(m => m.name === "Serenity").selection.value).toBe(1);
	});

	it("re-applying the same playbook does not duplicate its moves", async () => {
		withMovesPack(move("Serenity"), move("Invoke the Gods"));
		const character = new StonetopCharacter(new FakeCharacterActorBuilder().build(), new FoundryRepositoryFactory());
		const pb = () => playbookItem({ moves: ["serenity", "invoke-the-gods"], startingMoves: ["serenity"] });

		await character._onCreateDescendantDocuments([pb()]);
		await character._onCreateDescendantDocuments([pb()]);

		const cat = (await character.buildSnapshot()).moves.categories.find(c => c.key === "playbook-the-blessed");
		expect(cat.moves.map(m => m.name).sort()).toEqual(["Invoke the Gods", "Serenity"]);
	});

	// A playbook's grants arrive and leave together: the insert it hands you is a source in its own
	// right, so its moves come with it, and deleting the playbook item takes the whole set back.
	it("an insert a playbook grants brings its own moves", async () => {
		const pack = FakePackBuilder.movesPack();
		pack.withItem(move("Haunt"));
		const inserts = new FakePackBuilder("inserts")
			.withItem({ _id: "in1", name: "Revenant", type: "insert",
				system: { slug: "revenant", moves: ["haunt"], startingMoves: ["haunt"], choices: [], instinct: null } });
		new FakeGameBuilder().withPack(pack).withPack(inserts).build();
		const character = new StonetopCharacter(new FakeCharacterActorBuilder().build(), new FoundryRepositoryFactory());

		await character._onCreateDescendantDocuments([playbookItem({ inserts: ["revenant"] })]);

		const cat = (await character.buildSnapshot()).moves.categories.find(c => c.key === "insert-revenant");
		expect(cat?.moves.map(m => m.name)).toContain("Haunt");
	});

	it("deleting the playbook item takes back everything it granted", async () => {
		withMovesPack(move("Serenity"));
		const actor = new FakeCharacterActorBuilder().build();
		const character = new StonetopCharacter(actor, new FoundryRepositoryFactory());
		const item = playbookItem({ moves: ["serenity"], startingMoves: ["serenity"] });

		await character._onCreateDescendantDocuments([item]);
		expect([...actor.items].some(i => i.type === "move")).toBe(true);

		await character._onDeleteDescendantDocuments([item]);
		expect([...actor.items].some(i => i.type === "move")).toBe(false);
	});

	it("deleting the playbook item leaves what the player added by hand", async () => {
		withMovesPack(move("Serenity"));
		const actor = new FakeCharacterActorBuilder()
			.addItem({ _id: "own1", type: "move", name: "Hand Added", system: { slug: "hand-added", categoryKey: "other" } })
			.build();
		const character = new StonetopCharacter(actor, new FoundryRepositoryFactory());
		const item = playbookItem({ moves: ["serenity"], startingMoves: ["serenity"] });

		await character._onCreateDescendantDocuments([item]);
		await character._onDeleteDescendantDocuments([item]);

		expect([...actor.items].map(i => i._id)).toEqual(["own1"]);
	});

	it("inserts still add their moves to the moves tab", async () => {
		withMovesPack(move("Haunt"));
		const character = new StonetopCharacter(new FakeCharacterActorBuilder().build(), new FoundryRepositoryFactory());

		await character._onCreateDescendantDocuments([
			{ _id: "in1", type: "insert", name: "Revenant",
				system: { slug: "revenant", moves: ["haunt"], startingMoves: ["haunt"], choices: [], instinct: null } },
		]);

		const cat = (await character.buildSnapshot()).moves.categories.find(c => c.key === "insert-revenant");
		expect(cat?.moves.map(m => m.name)).toContain("Haunt");
	});
});

// A background can hand you a move of its own — one the playbook does not otherwise offer. The link
// lives on a row of the background's choice group (the same grant an arcanum's card carries), so the
// move renders there, on the background, and is kept off the moves tab.
describe("StonetopCharacter — a background's own moves (integration)", () => {
	afterEach(() => vi.unstubAllGlobals());

	const DESTINED = {
		slug: "destined", label: "Destined", resource: { max: 3, title: "Omens" },
		choices: { slug: "destined", list: [
			{ type: "entry", slug: "marked", content: { text: "marked at birth" }, track: { max: 1 } },
			{ type: "entry", grants: [{ type: "move", slug: "destined", locations: ["inline"] }] },
		]},
	};
	const BACKGROUNDS = [{ slug: "impetuous-youth", label: "Impetuous Youth" }, DESTINED];

	// Faithful to the real drop: Foundry embeds the playbook item, THEN fires the create hook with that
	// same document — and the background lookups read the embedded item, not the one passed in.
	function characterWithBackground(selected) {
		const item  = playbookItem({ moves: ["serenity"], startingMoves: [], backgrounds: BACKGROUNDS });
		const actor = new FakeCharacterActorBuilder().addItem(item).build();
		actor.system.background = { selected };
		return { actor, item, character: new StonetopCharacter(actor, new FoundryRepositoryFactory()) };
	}

	it("grants the linked move as an owned move item when the playbook lands", async () => {
		withMovesPack(move("Serenity"), new FakeCompendiumMoveBuilder().withName("Destined").withRollStat("omens").build());
		const { character, item } = characterWithBackground("destined");

		await character._onCreateDescendantDocuments([item]);

		const snap = await character.buildSnapshot();
		expect(snap.moves.bySlug["destined"]?.ownedId).toBeTruthy();
		expect(snap.moves.bySlug["destined"].rollStat).toBe("omens");
		expect(snap.moves.bySlug["destined"].selection.value).toBe(1);   // yours already, not tick-to-unlock
	});

	it("keeps that move off the moves tab — it is reached on the background", async () => {
		withMovesPack(move("Serenity"), move("Destined"));
		const { character, item } = characterWithBackground("destined");

		await character._onCreateDescendantDocuments([item]);

		const snap = await character.buildSnapshot();
		expect(snap.moves.categories.find(c => c.key === "background-destined")).toBeUndefined();
		expect(snap.moves.categories.flatMap(c => c.moves.map(m => m.name))).not.toContain("Destined");
		expect(snap.moves.categories.flatMap(c => c.moves.map(m => m.name))).toContain("Serenity");
	});

	it("grants nothing for a background that links no moves", async () => {
		withMovesPack(move("Serenity"), move("Destined"));
		const { character, item } = characterWithBackground("impetuous-youth");

		await character._onCreateDescendantDocuments([item]);

		expect((await character.buildSnapshot()).moves.bySlug["destined"]).toBeUndefined();
	});

	it("hands the move over on choosing that background, and back on leaving it", async () => {
		withMovesPack(move("Serenity"), move("Destined"));
		const { character, item } = characterWithBackground("impetuous-youth");
		await character._onCreateDescendantDocuments([item]);

		await character.selectBackground("destined");
		expect((await character.buildSnapshot()).moves.bySlug["destined"]?.ownedId).toBeTruthy();

		await character.selectBackground("impetuous-youth");
		expect((await character.buildSnapshot()).moves.bySlug["destined"]).toBeUndefined();
	});

	// The background names its own track, so the move it grants can roll +it.
	it("rolls the granted move against the background's track", async () => {
		withMovesPack(move("Serenity"), move("Destined"));
		const { character, item } = characterWithBackground("destined");
		await character._onCreateDescendantDocuments([item]);

		await character.setBackgroundResource("destined", 2);

		expect(character.resolveBonus("omens")).toBe(2);
	});
});
