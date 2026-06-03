import {afterEach, describe, expect, it, vi} from "vitest";
import {FoundryMoveRepository} from "../../../../src/actors/character/repositories/FoundryMoveRepository.js";
import {Move} from "../../../../src/model/data/Move.js";
import {FakeCompendiumMoveBuilder} from "../../../fakes/FakeCompendiumMoveBuilder.js";
import {FakeGameBuilder} from "../../../fakes/FakeGameBuilder.js";
import {FakePackBuilder} from "../../../fakes/FakePackBuilder.js";

// -- Helpers ------------------------------------------------------------------

function mv(name, {requires = null, minLevel = null} = {}) {
	return {name, requires, minLevel};
}

function names(ms) {
	return ms.map(m => m.name);
}

const repo = new FoundryMoveRepository();

// -- Fixtures ------------------------------------------------------------------

const BLESSED_MOVE_A = new FakeCompendiumMoveBuilder().withName("Serenity").withPlaybook("The Blessed").withRollType("stat").asStarting().build();
const BLESSED_MOVE_B = new FakeCompendiumMoveBuilder().withName("Invoke the Gods").withPlaybook("The Blessed").withRollType("stat").build();
const MARSHAL_MOVE_A = new FakeCompendiumMoveBuilder().withName("Read the Winds").withPlaybook("The Marshal").withRollType("stat").asStarting().build();
const BASIC_MOVE_A   = new FakeCompendiumMoveBuilder().withName("Defy Danger").withRollType("stat").build();
const BASIC_MOVE_B   = new FakeCompendiumMoveBuilder().withName("Aid or Interfere").withRollType("stat").build();
const REVENANT_MOVE_A = new FakeCompendiumMoveBuilder().withName("Unliving").withPlaybook("revenant").build();
const REVENANT_MOVE_B = new FakeCompendiumMoveBuilder().withName("Undying").withPlaybook("revenant").withRollType("con").build();
const GHOST_MOVE_A   = new FakeCompendiumMoveBuilder().withName("Disembodied").withPlaybook("ghost").build();

describe("FoundryMoveRepository", () => {
	afterEach(() => vi.unstubAllGlobals());

	describe("getPlaybookMoves", () => {
		it("returns [] when pack is not registered", async () => {
			new FakeGameBuilder().build();
			const repo = new FoundryMoveRepository();
			expect(await repo.getPlaybookMoves("The Blessed")).toEqual([]);
		});

		it("returns Move instances matching playbookName", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.playbookMovesPack().withItem(BLESSED_MOVE_A).withItem(BLESSED_MOVE_B).withItem(MARSHAL_MOVE_A))
				.build();

			const repo = new FoundryMoveRepository();
			const moves = await repo.getPlaybookMoves("The Blessed");
			expect(moves).toHaveLength(2);
			expect(moves[0]).toBeInstanceOf(Move);
			expect(moves.map(m => m.id)).toEqual([BLESSED_MOVE_B._id, BLESSED_MOVE_A._id]);
		});

		it("returns [] when no moves match playbookName", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.playbookMovesPack().withItem(BLESSED_MOVE_A))
				.build();
			const repo = new FoundryMoveRepository();
			expect(await repo.getPlaybookMoves("The Marshal")).toEqual([]);
		});

		it("caches result — same array returned on second call", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.playbookMovesPack().withItem(BLESSED_MOVE_A))
				.build();
			const repo = new FoundryMoveRepository();
			const first  = await repo.getPlaybookMoves("The Blessed");
			const second = await repo.getPlaybookMoves("The Blessed");
			expect(second).toBe(first);
		});

		it("does not share cache across different playbook names", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.playbookMovesPack().withItem(BLESSED_MOVE_A).withItem(MARSHAL_MOVE_A))
				.build();
			const repo = new FoundryMoveRepository();
			const blessed = await repo.getPlaybookMoves("The Blessed");
			const marshal = await repo.getPlaybookMoves("The Marshal");
			expect(blessed.map(m => m.id)).toEqual([BLESSED_MOVE_A._id]);
			expect(marshal.map(m => m.id)).toEqual([MARSHAL_MOVE_A._id]);
		});
	});

	describe("getPlaybookMoveDocument", () => {
		it("returns null when pack is not registered", async () => {
			new FakeGameBuilder().build();
			const repo = new FoundryMoveRepository();
			expect(await repo.getPlaybookMoveDocument(BLESSED_MOVE_A._id)).toBeNull();
		});

		it("returns the document when found", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.playbookMovesPack().withItem(BLESSED_MOVE_A))
				.build();
			const repo = new FoundryMoveRepository();
			const doc = await repo.getPlaybookMoveDocument(BLESSED_MOVE_A._id);
			expect(doc).toEqual(BLESSED_MOVE_A);
		});
	});

	describe("getBasicMoves", () => {
		it("returns [] when pack is not registered", async () => {
			new FakeGameBuilder().build();
			const repo = new FoundryMoveRepository();
			expect(await repo.getBasicMoves()).toEqual([]);
		});

		it("returns Move instances for all moves", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.basicMovesPack().withItem(BASIC_MOVE_A).withItem(BASIC_MOVE_B))
				.build();
			const repo = new FoundryMoveRepository();
			const moves = await repo.getBasicMoves();
			expect(moves).toHaveLength(2);
			expect(moves[0]).toBeInstanceOf(Move);
			expect(moves.map(m => m.id)).toEqual([BASIC_MOVE_A._id, BASIC_MOVE_B._id]);
		});

	});

	describe("getBasicMoveDocument", () => {
		it("returns null when pack is not registered and no world item", async () => {
			new FakeGameBuilder().build();
			const repo = new FoundryMoveRepository();
			expect(await repo.getBasicMoveDocument(BASIC_MOVE_A._id)).toBeNull();
		});

		it("returns the document when found in pack", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.basicMovesPack().withItem(BASIC_MOVE_A))
				.build();
			const repo = new FoundryMoveRepository();
			const doc = await repo.getBasicMoveDocument(BASIC_MOVE_A._id);
			expect(doc).toEqual(BASIC_MOVE_A);
		});

		it("falls back to world item when not in pack", async () => {
			const worldMove = new FakeCompendiumMoveBuilder().withName("World Basic Move").withMoveType("basic").build();
			new FakeGameBuilder().withWorldItem(worldMove).build();
			const repo = new FoundryMoveRepository();
			const doc = await repo.getBasicMoveDocument(worldMove._id);
			expect(doc).toEqual(worldMove);
		});
	});

	describe("getPostDeathMoves", () => {
		it("returns [] when pack is not registered", async () => {
			new FakeGameBuilder().build();
			const repo = new FoundryMoveRepository();
			expect(await repo.getPostDeathMoves("revenant")).toEqual([]);
		});

		it("returns Move instances filtered by insertSlug", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.postDeathMovesPack().withItem(REVENANT_MOVE_A).withItem(REVENANT_MOVE_B).withItem(GHOST_MOVE_A))
				.build();

			const repo = new FoundryMoveRepository();
			const moves = await repo.getPostDeathMoves("revenant");
			expect(moves).toHaveLength(2);
			expect(moves[0]).toBeInstanceOf(Move);
			expect(moves.map(m => m.id)).toEqual([REVENANT_MOVE_A._id, REVENANT_MOVE_B._id]);
		});

		it("returns [] when no moves match insertSlug", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.postDeathMovesPack().withItem(REVENANT_MOVE_A).withItem(REVENANT_MOVE_B).withItem(GHOST_MOVE_A))
				.build();

			const repo = new FoundryMoveRepository();
			expect(await repo.getPostDeathMoves("thrall")).toEqual([]);
		});

		it("caches result — same array returned on second call for same insertSlug", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.postDeathMovesPack().withItem(REVENANT_MOVE_A))
				.build();

			const repo = new FoundryMoveRepository();
			const first  = await repo.getPostDeathMoves("revenant");
			const second = await repo.getPostDeathMoves("revenant");
			expect(second).toBe(first);
		});
	});

	describe("getPostDeathMoveDocument", () => {
		it("returns null when pack is not registered", async () => {
			new FakeGameBuilder().build();
			const repo = new FoundryMoveRepository();
			expect(await repo.getPostDeathMoveDocument(REVENANT_MOVE_A._id)).toBeNull();
		});

		it("returns the document when found", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.postDeathMovesPack().withItem(REVENANT_MOVE_A))
				.build();
			const repo = new FoundryMoveRepository();
			const doc = await repo.getPostDeathMoveDocument(REVENANT_MOVE_A._id);
			expect(doc).toEqual(REVENANT_MOVE_A);
		});
	});
});

describe("FoundryMoveRepository.sortPlaybookMoves", () => {
	it("returns empty array for empty input", () => {
		expect(repo.sortPlaybookMoves([])).toEqual([]);
	});

	it("single move with no requires is returned as-is", () => {
		expect(names(repo.sortPlaybookMoves([mv("Alpha")]))).toEqual(["Alpha"]);
	});

	it("multiple independent moves are sorted alphabetically", () => {
		expect(names(repo.sortPlaybookMoves([mv("Charlie"), mv("Alpha"), mv("Bravo")]))).toEqual(["Alpha", "Bravo", "Charlie"]);
	});

	it("a move that requires another follows it immediately", () => {
		expect(names(repo.sortPlaybookMoves([mv("Child", {requires: "Parent"}), mv("Parent"), mv("Alpha")]))).toEqual(["Alpha", "Parent", "Child"]);
	});

	it("multiple moves requiring same parent sorted alphabetically after it", () => {
		expect(names(repo.sortPlaybookMoves([mv("Zeta", {requires: "Parent"}), mv("Alpha", {requires: "Parent"}), mv("Parent"), mv("Root")]))).toEqual(["Parent", "Alpha", "Zeta", "Root"]);
	});

	it("chains: grandchild follows child follows parent", () => {
		expect(names(repo.sortPlaybookMoves([mv("Grandchild", {requires: "Child"}), mv("Child", {requires: "Parent"}), mv("Parent")]))).toEqual(["Parent", "Child", "Grandchild"]);
	});

	it("root moves stay alphabetical while dependents follow their parents", () => {
		expect(names(repo.sortPlaybookMoves([mv("Zeal"), mv("Zeal-Child", {requires: "Zeal"}), mv("Armor"), mv("Armor-Child-B", {requires: "Armor"}), mv("Armor-Child-A", {requires: "Armor"})]))).toEqual(["Armor", "Armor-Child-A", "Armor-Child-B", "Zeal", "Zeal-Child"]);
	});

	it("move requiring non-existent parent treated as root", () => {
		expect(names(repo.sortPlaybookMoves([mv("Orphan", {requires: "Missing Parent"}), mv("Alpha")]))).toEqual(["Alpha", "Orphan"]);
	});

	it("circular dependency does not infinite-loop", () => {
		const ms = [mv("A", {requires: "B"}), mv("B", {requires: "A"})];
		expect(() => repo.sortPlaybookMoves(ms)).not.toThrow();
		expect(repo.sortPlaybookMoves(ms)).toHaveLength(2);
	});

	it("level-6 moves come after all level-0 moves", () => {
		expect(names(repo.sortPlaybookMoves([mv("Bravo", {minLevel: 6}), mv("Alpha"), mv("Charlie", {minLevel: 6})]))).toEqual(["Alpha", "Bravo", "Charlie"]);
	});

	it("level groups sorted ascending: 0, 2, 6", () => {
		expect(names(repo.sortPlaybookMoves([mv("L6", {minLevel: 6}), mv("L2", {minLevel: 2}), mv("L0")]))).toEqual(["L0", "L2", "L6"]);
	});

	it("within a level group, dependency chaining still applies", () => {
		expect(names(repo.sortPlaybookMoves([mv("Child", {minLevel: 6, requires: "Parent"}), mv("Parent", {minLevel: 6}), mv("Alpha", {minLevel: 6})]))).toEqual(["Alpha", "Parent", "Child"]);
	});

	it("cross-level dependency ignored: level-6 move stays in level-6 group", () => {
		expect(names(repo.sortPlaybookMoves([mv("Root"), mv("Lv6-Child", {minLevel: 6, requires: "Root"}), mv("Alpha")]))).toEqual(["Alpha", "Root", "Lv6-Child"]);
	});
});
