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
