import { describe, it, expect, vi } from "vitest";
import { StonetopCharacter } from "../../../module/actors/character/StonetopCharacter.js";

// -- Fake repositories --------------------------------------------------------

class FakePlaybookRepository {
	constructor(playbook) { this._playbook = playbook; }
	async findBySlug() { return this._playbook; }
}

class FakePlaybookMoveRepository {
	constructor(moves = []) { this._moves = moves; }
	async getMovesForPlaybook() { return this._moves; }
	async getDocument(id) { return this._moves.find(m => m._id === id) ?? null; }
}

class FakeBasicMoveRepository {
	constructor(moves = []) { this._moves = moves; }
	async getAll() { return this._moves; }
}

// -- Fake actor ---------------------------------------------------------------

function makeActor({ system = {}, flags = {}, items = [] } = {}) {
	const flagStore = { stonetop: { ...flags } };
	return {
		type: "character",
		system: {
			playbook: { slug: null, name: null },
			attributes: { level: { value: 1 } },
			...system,
		},
		items,
		flags: flagStore,
		getFlag: (scope, key) => flagStore[scope]?.[key] ?? null,
		setFlag: vi.fn(async (scope, key, val) => { flagStore[scope] ??= {}; flagStore[scope][key] = val; }),
		update: vi.fn(),
		createEmbeddedDocuments: vi.fn(),
		deleteEmbeddedDocuments: vi.fn(),
	};
}

function makeCharacter(actor, playbookRepo, playbookMoveRepo, basicMoveRepo) {
	return new StonetopCharacter(
		actor,
		playbookRepo ?? new FakePlaybookRepository(null),
		playbookMoveRepo ?? new FakePlaybookMoveRepository(),
		basicMoveRepo ?? new FakeBasicMoveRepository(),
	);
}

// -- Playbook fixture ---------------------------------------------------------

const BLESSED_PLAYBOOK = {
	backgrounds: [
		{ slug: "initiate",         label: "Initiate",         description: "<p>Initiate desc.</p>", moves: ["Rites of the Land"] },
		{ slug: "raised-by-wolves", label: "Raised by Wolves", description: "<p>Wolves desc.</p>",   moves: ["Trackless Step"] },
		{ slug: "vessel",           label: "Vessel",           description: "<p>Vessel desc.</p>",   moves: ["Danu's Grasp"] },
	],
	instincts: [
		{ word: "Delight",      description: "To find beauty, in even the ugliest things." },
		{ word: "Detachment",   description: "To remain unmoved, to be cold as winter." },
		{ word: "Preservation", description: "To protect the natural world." },
	],
	appearance: [
		["fresh-faced", "hale & hearty", "gray & wizened"],
		["curvy", "strapping", "rail-thin"],
	],
	origin: [
		{ region: "Stonetop",      names: ["Arwel", "Blodwen"] },
		{ region: "Barrier Pass",  names: ["Alagh", "Bora"] },
	],
	startingMovesNote: null,
};

// -- buildSheetData -----------------------------------------------------------

describe("StonetopCharacter.buildSheetData", () => {
	it("returns hasPlaybook=false with empty arrays when no playbook", async () => {
		const actor = makeActor();
		const char = makeCharacter(actor);
		const data = await char.buildSheetData();
		expect(data.hasPlaybook).toBe(false);
		expect(data.backgrounds).toHaveLength(0);
		expect(data.instincts).toHaveLength(0);
		expect(data.appearance).toHaveLength(0);
		expect(data.origins).toHaveLength(0);
		expect(data.savedInstinct).toBe("");
	});

	it("returns hasPlaybook=true when playbook present", async () => {
		const actor = makeActor({ system: { playbook: { slug: "the-blessed", name: "The Blessed" } } });
		const char = makeCharacter(actor, new FakePlaybookRepository(BLESSED_PLAYBOOK));
		const data = await char.buildSheetData();
		expect(data.hasPlaybook).toBe(true);
	});

	describe("with no saved selections", () => {
		async function buildCtx() {
			const actor = makeActor({ system: { playbook: { slug: "the-blessed", name: "The Blessed" } } });
			return makeCharacter(actor, new FakePlaybookRepository(BLESSED_PLAYBOOK)).buildSheetData();
		}

		it("maps backgrounds, none selected", async () => {
			const data = await buildCtx();
			expect(data.backgrounds).toHaveLength(3);
			expect(data.backgrounds.every(b => !b.selected)).toBe(true);
		});

		it("maps instincts with value field and none selected", async () => {
			const data = await buildCtx();
			expect(data.instincts).toHaveLength(3);
			expect(data.instincts[0].value).toBe("Delight — To find beauty, in even the ugliest things.");
			expect(data.instincts.every(i => !i.selected)).toBe(true);
		});

		it("maps appearance lines with lineIdx and no selections", async () => {
			const data = await buildCtx();
			expect(data.appearance).toHaveLength(2);
			expect(data.appearance[0].lineIdx).toBe(0);
			expect(data.appearance[0].options.every(o => !o.selected)).toBe(true);
		});

		it("maps origins with none selected", async () => {
			const data = await buildCtx();
			expect(data.origins).toHaveLength(2);
			expect(data.origins.every(o => !o.selected)).toBe(true);
			expect(data.origins[0].region).toBe("Stonetop");
		});
	});

	describe("with saved selections", () => {
		async function buildCtx() {
			const actor = makeActor({
				system: { playbook: { slug: "the-blessed", name: "The Blessed" } },
				flags: {
					"background.selected": "vessel",
					"instinct.selected": "Delight — To find beauty, in even the ugliest things.",
					"appearance.selected": { 0: "gray & wizened" },
					"origin.selected": "Barrier Pass",
				},
			});
			return makeCharacter(actor, new FakePlaybookRepository(BLESSED_PLAYBOOK)).buildSheetData();
		}

		it("marks the saved background as selected", async () => {
			const data = await buildCtx();
			expect(data.backgrounds.find(b => b.slug === "vessel").selected).toBe(true);
			expect(data.backgrounds.filter(b => b.selected)).toHaveLength(1);
		});

		it("marks the matching instinct as selected and sets savedInstinct", async () => {
			const data = await buildCtx();
			expect(data.savedInstinct).toBe("Delight — To find beauty, in even the ugliest things.");
			expect(data.instincts.find(i => i.word === "Delight").selected).toBe(true);
		});

		it("marks saved appearance option as selected", async () => {
			const data = await buildCtx();
			expect(data.appearance[0].options.find(o => o.value === "gray & wizened").selected).toBe(true);
		});

		it("marks the saved origin as selected", async () => {
			const data = await buildCtx();
			expect(data.origins.find(o => o.region === "Barrier Pass").selected).toBe(true);
		});
	});
});

// -- buildMovelistContext -----------------------------------------------------

function makeEntry(overrides = {}) {
	return {
		_id: overrides._id ?? "abc123",
		name: overrides.name ?? "Test Move",
		system: {
			description: overrides.description ?? "A test move.",
			stat: overrides.stat ?? null,
			isStartingMove: overrides.isStartingMove ?? false,
			requirement: overrides.requirement ?? null,
		},
	};
}

describe("StonetopCharacter.buildMovelistContext", () => {
	const char = makeCharacter(makeActor());

	it("returns empty array for empty entries", () => {
		expect(char.buildMovelistContext([], new Map(), new Set(), 1)).toHaveLength(0);
	});

	it("unowned move with no lock: owned=false, locked=false", () => {
		const [m] = char.buildMovelistContext([makeEntry()], new Map(), new Set(), 1);
		expect(m.owned).toBe(false);
		expect(m.locked).toBe(false);
		expect(m.ownedId).toBeNull();
	});

	it("owned move: owned=true, ownedId set", () => {
		const entry = makeEntry({ name: "Bulwark" });
		const owned = { _id: "item-xyz" };
		const [m] = char.buildMovelistContext([entry], new Map([["Bulwark", [owned]]]), new Set(), 1);
		expect(m.owned).toBe(true);
		expect(m.ownedId).toBe("item-xyz");
	});

	it("isStartingMove: isStarting=true, locked=false", () => {
		const [m] = char.buildMovelistContext([makeEntry({ isStartingMove: true })], new Map(), new Set(), 1);
		expect(m.isStarting).toBe(true);
		expect(m.locked).toBe(false);
	});

	it("background move name in bgMoveNames: isStarting=true", () => {
		const entry = makeEntry({ name: "Trackless Step" });
		const [m] = char.buildMovelistContext([entry], new Map(), new Set(["Trackless Step"]), 1);
		expect(m.isStarting).toBe(true);
		expect(m.locked).toBe(false);
	});

	it("requires a move not owned: locked=true", () => {
		const entry = makeEntry({ requirement: { moves: ["Glorious Servant"] } });
		const [m] = char.buildMovelistContext([entry], new Map(), new Set(), 1);
		expect(m.locked).toBe(true);
	});

	it("requires a move that IS owned: locked=false", () => {
		const entry = makeEntry({ requirement: { moves: ["Glorious Servant"] } });
		const ownedBy = new Map([["Glorious Servant", [{ _id: "gs-id" }]]]);
		const [m] = char.buildMovelistContext([entry], ownedBy, new Set(), 1);
		expect(m.locked).toBe(false);
	});

	it("minLevel above actor level: locked=true", () => {
		const entry = makeEntry({ requirement: { level: 6 } });
		const [m] = char.buildMovelistContext([entry], new Map(), new Set(), 1);
		expect(m.locked).toBe(true);
	});

	it("minLevel at or below actor level: locked=false", () => {
		const entry = makeEntry({ requirement: { level: 3 } });
		const [m] = char.buildMovelistContext([entry], new Map(), new Set(), 3);
		expect(m.locked).toBe(false);
	});

	it("stat field maps to rollType", () => {
		const [m] = char.buildMovelistContext([makeEntry({ stat: "con" })], new Map(), new Set(), 1);
		expect(m.rollType).toBe("con");
	});

	it("starting move with requires is NOT locked (isStarting overrides)", () => {
		const entry = makeEntry({ isStartingMove: true, requirement: { moves: ["Some Move"] } });
		const [m] = char.buildMovelistContext([entry], new Map(), new Set(), 1);
		expect(m.isStarting).toBe(true);
		expect(m.locked).toBe(false);
	});

	it("requires playbook not matching: locked=true", () => {
		const entry = makeEntry({ requirement: { playbook: "The Blessed" } });
		const [m] = char.buildMovelistContext([entry], new Map(), new Set(), 1, "The Fox");
		expect(m.locked).toBe(true);
	});

	it("requires playbook matching actor: locked=false", () => {
		const entry = makeEntry({ requirement: { playbook: "The Blessed" } });
		const [m] = char.buildMovelistContext([entry], new Map(), new Set(), 1, "The Blessed");
		expect(m.locked).toBe(false);
	});

	it("requiresLabel joins multiple moves", () => {
		const entry = makeEntry({ requirement: { moves: ["Move A", "Move B"] } });
		const [m] = char.buildMovelistContext([entry], new Map(), new Set(), 1);
		expect(m.requiresLabel).toBe("Move A, Move B");
	});

	it("requiresPlaybook set from requirement.playbook", () => {
		const entry = makeEntry({ requirement: { playbook: "The Blessed" } });
		const [m] = char.buildMovelistContext([entry], new Map(), new Set(), 1, "The Blessed");
		expect(m.requiresPlaybook).toBe("The Blessed");
	});
});

// -- sortPlaybookMoves --------------------------------------------------------

function mv(name, { requires = null, minLevel = null } = {}) { return { name, requires, minLevel }; }
function names(moves) { return moves.map(m => m.name); }

describe("StonetopCharacter.sortPlaybookMoves", () => {
	const char = makeCharacter(makeActor());

	it("returns empty array for empty input", () => {
		expect(char.sortPlaybookMoves([])).toEqual([]);
	});

	it("single move with no requires is returned as-is", () => {
		expect(names(char.sortPlaybookMoves([mv("Alpha")]))).toEqual(["Alpha"]);
	});

	it("multiple independent moves are sorted alphabetically", () => {
		expect(names(char.sortPlaybookMoves([mv("Charlie"), mv("Alpha"), mv("Bravo")]))).toEqual(["Alpha", "Bravo", "Charlie"]);
	});

	it("a move that requires another follows it immediately", () => {
		const result = names(char.sortPlaybookMoves([mv("Child", { requires: "Parent" }), mv("Parent"), mv("Alpha")]));
		expect(result).toEqual(["Alpha", "Parent", "Child"]);
	});

	it("multiple moves requiring the same parent are sorted alphabetically after it", () => {
		const moves = [mv("Zeta", { requires: "Parent" }), mv("Alpha", { requires: "Parent" }), mv("Parent"), mv("Root")];
		expect(names(char.sortPlaybookMoves(moves))).toEqual(["Parent", "Alpha", "Zeta", "Root"]);
	});

	it("chains: grandchild follows child follows parent", () => {
		const moves = [mv("Grandchild", { requires: "Child" }), mv("Child", { requires: "Parent" }), mv("Parent")];
		expect(names(char.sortPlaybookMoves(moves))).toEqual(["Parent", "Child", "Grandchild"]);
	});

	it("root moves stay alphabetical while dependents follow their parents", () => {
		const moves = [
			mv("Zeal"), mv("Zeal-Child", { requires: "Zeal" }),
			mv("Armor"), mv("Armor-Child-B", { requires: "Armor" }), mv("Armor-Child-A", { requires: "Armor" }),
		];
		expect(names(char.sortPlaybookMoves(moves))).toEqual(["Armor", "Armor-Child-A", "Armor-Child-B", "Zeal", "Zeal-Child"]);
	});

	it("move requiring a non-existent parent is treated as a root", () => {
		expect(names(char.sortPlaybookMoves([mv("Orphan", { requires: "Missing Parent" }), mv("Alpha")]))).toEqual(["Alpha", "Orphan"]);
	});

	it("circular dependency does not infinite-loop", () => {
		const moves = [mv("A", { requires: "B" }), mv("B", { requires: "A" })];
		expect(() => char.sortPlaybookMoves(moves)).not.toThrow();
		expect(char.sortPlaybookMoves(moves)).toHaveLength(2);
	});

	it("level-6 moves come after all level-0 moves", () => {
		expect(names(char.sortPlaybookMoves([mv("Bravo", { minLevel: 6 }), mv("Alpha"), mv("Charlie", { minLevel: 6 })]))).toEqual(["Alpha", "Bravo", "Charlie"]);
	});

	it("level groups are sorted ascending: 0, 2, 6", () => {
		expect(names(char.sortPlaybookMoves([mv("L6", { minLevel: 6 }), mv("L2", { minLevel: 2 }), mv("L0")]))).toEqual(["L0", "L2", "L6"]);
	});

	it("within a level group, dependency chaining still applies", () => {
		const moves = [mv("Child", { minLevel: 6, requires: "Parent" }), mv("Parent", { minLevel: 6 }), mv("Alpha", { minLevel: 6 })];
		expect(names(char.sortPlaybookMoves(moves))).toEqual(["Alpha", "Parent", "Child"]);
	});

	it("cross-level dependency is ignored: level-6 move requiring level-0 move stays in level-6 group", () => {
		const moves = [mv("Root"), mv("Lv6-Child", { minLevel: 6, requires: "Root" }), mv("Alpha")];
		expect(names(char.sortPlaybookMoves(moves))).toEqual(["Alpha", "Root", "Lv6-Child"]);
	});
});

// -- ensureStartingMoves ------------------------------------------------------

describe("StonetopCharacter.ensureStartingMoves", () => {
	function makeMoveEntry(name, isStartingMove, id) {
		return { _id: id, name, system: { isStartingMove, playbook: "The Blessed" }, toObject: () => ({ name }) };
	}

	it("does nothing when no playbook set", async () => {
		const actor = makeActor();
		const char = makeCharacter(actor);
		await char.ensureStartingMoves();
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("adds missing starting moves", async () => {
		const actor = makeActor({ system: { playbook: { slug: "the-blessed", name: "The Blessed" } } });
		const entries = [makeMoveEntry("Rites of the Land", true, "id1")];
		const char = makeCharacter(actor, new FakePlaybookRepository(BLESSED_PLAYBOOK), new FakePlaybookMoveRepository(entries));
		await char.ensureStartingMoves();
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [{ name: "Rites of the Land" }]);
	});

	it("does not add moves the actor already owns", async () => {
		const actor = makeActor({
			system: { playbook: { slug: "the-blessed", name: "The Blessed" } },
			items: [{ type: "move", name: "Rites of the Land" }],
		});
		const entries = [makeMoveEntry("Rites of the Land", true, "id1")];
		const char = makeCharacter(actor, new FakePlaybookRepository(BLESSED_PLAYBOOK), new FakePlaybookMoveRepository(entries));
		await char.ensureStartingMoves();
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("adds background-specific moves based on selected background", async () => {
		const actor = makeActor({
			system: { playbook: { slug: "the-blessed", name: "The Blessed" } },
			flags: { "background.selected": "initiate" },
		});
		const entries = [makeMoveEntry("Rites of the Land", false, "id1")];
		const char = makeCharacter(actor, new FakePlaybookRepository(BLESSED_PLAYBOOK), new FakePlaybookMoveRepository(entries));
		await char.ensureStartingMoves();
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [{ name: "Rites of the Land" }]);
	});
});
