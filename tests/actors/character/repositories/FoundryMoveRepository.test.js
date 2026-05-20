import { describe, it, expect, vi, afterEach } from "vitest";
import { FoundryMoveRepository } from "../../../../module/actors/character/repositories/FoundryMoveRepository.js";
import { MoveDefinition } from "../../../../module/model/MoveDefinition.js";

// -- Fixtures ------------------------------------------------------------------

const PLAYBOOK_MOVE_A = { _id: "pb001", name: "Serenity", system: { playbook: "The Blessed", rollType: "stat", isStartingMove: true } };
const PLAYBOOK_MOVE_B = { _id: "pb002", name: "Invoke the Gods", system: { playbook: "The Blessed", rollType: "stat", isStartingMove: false } };
const OTHER_MOVE      = { _id: "pb003", name: "Read the Winds", system: { playbook: "The Marshal", rollType: "stat", isStartingMove: true } };
const BASIC_MOVE_A    = { _id: "bm001", name: "Defy Danger", system: { rollType: "stat" } };
const BASIC_MOVE_B    = { _id: "bm002", name: "Aid or Interfere", system: { rollType: "stat" } };

// -- Helpers -------------------------------------------------------------------

function makePlaybookPack(entries = []) {
	return {
		getIndex: vi.fn(async () => {}),
		index: entries,
		getDocument: vi.fn(async (id) => entries.find(e => e._id === id) ?? null),
	};
}

function makeBasicPack(entries = []) {
	return {
		getIndex: vi.fn(async () => {}),
		index: entries,
		getDocument: vi.fn(async (id) => entries.find(e => e._id === id) ?? null),
	};
}

const POST_DEATH_MOVE_A = { _id: "pd001", name: "Unliving",   system: { playbook: "revenant", rollType: null } };
const POST_DEATH_MOVE_B = { _id: "pd002", name: "Undying",    system: { playbook: "revenant", rollType: "con" } };
const OTHER_INSERT_MOVE = { _id: "pd003", name: "Disembodied", system: { playbook: "ghost",   rollType: null } };

function makePostDeathPack(entries = []) {
	return {
		getIndex:    vi.fn(async () => {}),
		index:       entries,
		getDocument: vi.fn(async (id) => entries.find(e => e._id === id) ?? null),
	};
}

function stubGame(playbookPack, basicPack, postDeathPack = null) {
	vi.stubGlobal("game", {
		packs: {
			get: (name) => {
				if (name === "stonetop.playbook-moves")  return playbookPack;
				if (name === "stonetop.basic-moves")     return basicPack;
				if (name === "stonetop.post-death-moves") return postDeathPack;
				return null;
			},
		},
	});
}

function stubGameNoPacks() {
	vi.stubGlobal("game", { packs: { get: () => null } });
}

// -- Tests ---------------------------------------------------------------------

describe("FoundryMoveRepository", () => {
	afterEach(() => vi.unstubAllGlobals());

	describe("getPlaybookMoves", () => {
		it("returns [] when pack is not registered", async () => {
			stubGameNoPacks();
			const repo = new FoundryMoveRepository();
			expect(await repo.getPlaybookMoves("The Blessed")).toEqual([]);
		});

		it("returns MoveDefinition instances matching playbookName", async () => {
			stubGame(makePlaybookPack([PLAYBOOK_MOVE_A, PLAYBOOK_MOVE_B, OTHER_MOVE]), null);
			const repo = new FoundryMoveRepository();
			const moves = await repo.getPlaybookMoves("The Blessed");
			expect(moves).toHaveLength(2);
			expect(moves[0]).toBeInstanceOf(MoveDefinition);
			expect(moves.map(m => m.id)).toEqual(["pb001", "pb002"]);
		});

		it("returns [] when no moves match playbookName", async () => {
			stubGame(makePlaybookPack([PLAYBOOK_MOVE_A]), null);
			const repo = new FoundryMoveRepository();
			expect(await repo.getPlaybookMoves("The Marshal")).toEqual([]);
		});

		it("calls getIndex with the correct fields", async () => {
			const pack = makePlaybookPack([]);
			stubGame(pack, null);
			const repo = new FoundryMoveRepository();
			await repo.getPlaybookMoves("The Blessed");
			expect(pack.getIndex).toHaveBeenCalledWith({
				fields: ["system.playbook", "system.isStartingMove", "system.requirement",
				         "system.rollType", "system.description", "system.repeatMax", "system.resource"],
			});
		});

		it("caches result — getIndex not called a second time for same playbook", async () => {
			const pack = makePlaybookPack([PLAYBOOK_MOVE_A]);
			stubGame(pack, null);
			const repo = new FoundryMoveRepository();
			await repo.getPlaybookMoves("The Blessed");
			await repo.getPlaybookMoves("The Blessed");
			expect(pack.getIndex).toHaveBeenCalledTimes(1);
		});

		it("does not share cache across different playbook names", async () => {
			const pack = makePlaybookPack([PLAYBOOK_MOVE_A, OTHER_MOVE]);
			stubGame(pack, null);
			const repo = new FoundryMoveRepository();
			const blessed = await repo.getPlaybookMoves("The Blessed");
			const marshal = await repo.getPlaybookMoves("The Marshal");
			expect(blessed.map(m => m.id)).toEqual(["pb001"]);
			expect(marshal.map(m => m.id)).toEqual(["pb003"]);
		});
	});

	describe("getPlaybookMoveDocument", () => {
		it("returns null when pack is not registered", async () => {
			stubGameNoPacks();
			const repo = new FoundryMoveRepository();
			expect(await repo.getPlaybookMoveDocument("pb001")).toBeNull();
		});

		it("returns the document when found", async () => {
			const pack = makePlaybookPack([PLAYBOOK_MOVE_A]);
			stubGame(pack, null);
			const repo = new FoundryMoveRepository();
			const doc = await repo.getPlaybookMoveDocument("pb001");
			expect(doc).toEqual(PLAYBOOK_MOVE_A);
		});
	});

	describe("getBasicMoves", () => {
		it("returns [] when pack is not registered", async () => {
			stubGameNoPacks();
			const repo = new FoundryMoveRepository();
			expect(await repo.getBasicMoves()).toEqual([]);
		});

		it("returns MoveDefinition instances for all moves", async () => {
			stubGame(null, makeBasicPack([BASIC_MOVE_A, BASIC_MOVE_B]));
			const repo = new FoundryMoveRepository();
			const moves = await repo.getBasicMoves();
			expect(moves).toHaveLength(2);
			expect(moves[0]).toBeInstanceOf(MoveDefinition);
			expect(moves.map(m => m.id)).toEqual(["bm001", "bm002"]);
		});

		it("calls getIndex with the correct fields", async () => {
			const pack = makeBasicPack([]);
			stubGame(null, pack);
			const repo = new FoundryMoveRepository();
			await repo.getBasicMoves();
			expect(pack.getIndex).toHaveBeenCalledWith({ fields: ["system.rollType"] });
		});

		it("caches result — getIndex not called a second time", async () => {
			const pack = makeBasicPack([BASIC_MOVE_A]);
			stubGame(null, pack);
			const repo = new FoundryMoveRepository();
			await repo.getBasicMoves();
			await repo.getBasicMoves();
			expect(pack.getIndex).toHaveBeenCalledTimes(1);
		});
	});

	describe("getBasicMoveDocument", () => {
		it("returns null when pack is not registered", async () => {
			stubGameNoPacks();
			const repo = new FoundryMoveRepository();
			expect(await repo.getBasicMoveDocument("bm001")).toBeNull();
		});

		it("returns the document when found", async () => {
			const pack = makeBasicPack([BASIC_MOVE_A]);
			stubGame(null, pack);
			const repo = new FoundryMoveRepository();
			const doc = await repo.getBasicMoveDocument("bm001");
			expect(doc).toEqual(BASIC_MOVE_A);
		});
	});

	describe("getPostDeathMoves", () => {
		it("returns [] when pack is not registered", async () => {
			stubGameNoPacks();
			const repo = new FoundryMoveRepository();
			expect(await repo.getPostDeathMoves("revenant")).toEqual([]);
		});

		it("returns MoveDefinition instances filtered by insertSlug", async () => {
			const pack = makePostDeathPack([POST_DEATH_MOVE_A, POST_DEATH_MOVE_B, OTHER_INSERT_MOVE]);
			stubGame(null, null, pack);
			const repo  = new FoundryMoveRepository();
			const moves = await repo.getPostDeathMoves("revenant");
			expect(moves).toHaveLength(2);
			expect(moves[0]).toBeInstanceOf(MoveDefinition);
			expect(moves.map(m => m.id)).toEqual(["pd001", "pd002"]);
		});

		it("returns [] when no moves match insertSlug", async () => {
			const pack = makePostDeathPack([POST_DEATH_MOVE_A]);
			stubGame(null, null, pack);
			const repo = new FoundryMoveRepository();
			expect(await repo.getPostDeathMoves("thrall")).toEqual([]);
		});

		it("calls getIndex with the correct fields", async () => {
			const pack = makePostDeathPack([]);
			stubGame(null, null, pack);
			const repo = new FoundryMoveRepository();
			await repo.getPostDeathMoves("revenant");
			expect(pack.getIndex).toHaveBeenCalledWith({
				fields: ["system.playbook", "system.rollType", "system.description", "system.resource"],
			});
		});

		it("caches result — getIndex not called a second time for same insertSlug", async () => {
			const pack = makePostDeathPack([POST_DEATH_MOVE_A]);
			stubGame(null, null, pack);
			const repo = new FoundryMoveRepository();
			await repo.getPostDeathMoves("revenant");
			await repo.getPostDeathMoves("revenant");
			expect(pack.getIndex).toHaveBeenCalledTimes(1);
		});
	});

	describe("getPostDeathMoveDocument", () => {
		it("returns null when pack is not registered", async () => {
			stubGameNoPacks();
			const repo = new FoundryMoveRepository();
			expect(await repo.getPostDeathMoveDocument("pd001")).toBeNull();
		});

		it("returns the document when found", async () => {
			const pack = makePostDeathPack([POST_DEATH_MOVE_A]);
			stubGame(null, null, pack);
			const repo = new FoundryMoveRepository();
			const doc  = await repo.getPostDeathMoveDocument("pd001");
			expect(doc).toEqual(POST_DEATH_MOVE_A);
		});
	});
});
