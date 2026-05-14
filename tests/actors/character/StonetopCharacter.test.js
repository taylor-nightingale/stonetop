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

	it("isStartingMove: isStarting=true, source=Starting, locked=false", () => {
		const [m] = char.buildMovelistContext([makeEntry({ isStartingMove: true })], new Map(), new Set(), 1);
		expect(m.isStarting).toBe(true);
		expect(m.source).toBe("Starting");
		expect(m.locked).toBe(false);
	});

	it("background move name in bgMoveNames: isStarting=true, source=Background", () => {
		const entry = makeEntry({ name: "Trackless Step" });
		const [m] = char.buildMovelistContext([entry], new Map(), new Set(["Trackless Step"]), 1);
		expect(m.isStarting).toBe(true);
		expect(m.source).toBe("Background");
		expect(m.locked).toBe(false);
	});

	it("regular move: isStarting=false, source=null", () => {
		const [m] = char.buildMovelistContext([makeEntry({})], new Map(), new Set(), 1);
		expect(m.isStarting).toBe(false);
		expect(m.source).toBeNull();
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

// -- buildPossessionsContext --------------------------------------------------

const BASE_SP = {
	pickNote: "Pick 2",
	pickCount: 2,
	preselected: ["sacred-pouch"],
	options: [
		{ slug: "sacred-pouch", label: "Sacred pouch", description: "a magical pouch", uses: 3 },
		{ slug: "apiary",       label: "Apiary",        description: "bees" },
		{ slug: "mastiffs",     label: "Mastiffs",      description: "dogs" },
		{ slug: "herb-garden",  label: "Herb garden",   description: "herbs" },
	],
};

describe("buildPossessionsContext", () => {
	function makeChar() {
		return makeCharacter(makeActor());
	}

	it("returns null when specialPossessions is null", () => {
		expect(makeChar().buildPossessionsContext(null, new Set(), {}, {})).toBeNull();
	});

	it("passes pickNote through to output", () => {
		const ctx = makeChar().buildPossessionsContext(BASE_SP, new Set(), {}, {});
		expect(ctx.pickNote).toBe("Pick 2");
	});

	it("preselected option is always checked and disabled, source=Starting", () => {
		const ctx = makeChar().buildPossessionsContext(BASE_SP, new Set(), {}, {});
		const pouch = ctx.options.find(o => o.slug === "sacred-pouch");
		expect(pouch.checked).toBe(true);
		expect(pouch.disabled).toBe(true);
		expect(pouch.preselected).toBe(true);
		expect(pouch.preselectedSource).toBe("Starting");
	});

	it("unselected non-preselected option is unchecked and enabled when under limit", () => {
		const ctx = makeChar().buildPossessionsContext(BASE_SP, new Set(), {}, {});
		const apiary = ctx.options.find(o => o.slug === "apiary");
		expect(apiary.checked).toBe(false);
		expect(apiary.disabled).toBe(false);
	});

	it("selected option is checked and not disabled", () => {
		const ctx = makeChar().buildPossessionsContext(BASE_SP, new Set(["apiary"]), {}, {});
		const apiary = ctx.options.find(o => o.slug === "apiary");
		expect(apiary.checked).toBe(true);
		expect(apiary.disabled).toBe(false);
	});

	it("unselected options stay enabled even when pickCount is reached", () => {
		const ctx = makeChar().buildPossessionsContext(BASE_SP, new Set(["apiary", "mastiffs"]), {}, {});
		const herb = ctx.options.find(o => o.slug === "herb-garden");
		expect(herb.disabled).toBe(false);
	});

	it("already-selected options stay enabled even at pickCount limit", () => {
		const ctx = makeChar().buildPossessionsContext(BASE_SP, new Set(["apiary", "mastiffs"]), {}, {});
		const apiary = ctx.options.find(o => o.slug === "apiary");
		expect(apiary.disabled).toBe(false);
	});

	it("preselected option does not count against pickCount", () => {
		const ctx = makeChar().buildPossessionsContext(BASE_SP, new Set(["apiary", "mastiffs"]), {}, {});
		const pouch = ctx.options.find(o => o.slug === "sacred-pouch");
		expect(pouch.disabled).toBe(true);
		expect(pouch.preselected).toBe(true);
	});

	it("selected option with uses produces usesChecks array of correct length", () => {
		const ctx = makeChar().buildPossessionsContext(BASE_SP, new Set(["sacred-pouch"]), { "sacred-pouch": 2 }, {});
		const pouch = ctx.options.find(o => o.slug === "sacred-pouch");
		expect(pouch.usesChecks).toHaveLength(3);
		expect(pouch.usesChecks[0].checked).toBe(true);
		expect(pouch.usesChecks[1].checked).toBe(true);
		expect(pouch.usesChecks[2].checked).toBe(false);
	});

	it("unselected option with uses has usesChecks null", () => {
		const ctx = makeChar().buildPossessionsContext(BASE_SP, new Set(), {}, {});
		const apiary = ctx.options.find(o => o.slug === "apiary");
		expect(apiary.usesChecks).toBeNull();
	});

	it("option without uses field has usesChecks null even when selected", () => {
		const ctx = makeChar().buildPossessionsContext(BASE_SP, new Set(["apiary"]), {}, {});
		const apiary = ctx.options.find(o => o.slug === "apiary");
		expect(apiary.usesChecks).toBeNull();
	});

	it("maxUsesMap overrides base uses for circle count", () => {
		const ctx = makeChar().buildPossessionsContext(BASE_SP, new Set(["sacred-pouch"]), {}, { "sacred-pouch": 5 });
		const pouch = ctx.options.find(o => o.slug === "sacred-pouch");
		expect(pouch.usesChecks).toHaveLength(5);
	});

	it("extraPreselected slug is treated as preselected, source=Background", () => {
		const ctx = makeChar().buildPossessionsContext(BASE_SP, new Set(), {}, {}, ["apiary"]);
		const apiary = ctx.options.find(o => o.slug === "apiary");
		expect(apiary.checked).toBe(true);
		expect(apiary.disabled).toBe(true);
		expect(apiary.preselected).toBe(true);
		expect(apiary.preselectedSource).toBe("Background");
	});

	it("non-preselected option has preselectedSource=null", () => {
		const ctx = makeChar().buildPossessionsContext(BASE_SP, new Set(), {}, {});
		const apiary = ctx.options.find(o => o.slug === "apiary");
		expect(apiary.preselectedSource).toBeNull();
	});
});

// -- buildPossessionsContext: usesLabel + choiceGroups -----------------------

const SP_WITH_GROUPS = {
	pickNote: "Pick 1",
	pickCount: 1,
	preselected: ["pouch"],
	options: [{
		slug: "pouch",
		label: "Sacred pouch",
		description: "",
		uses: 3,
		usesLabel: "Stock",
		choiceGroups: [{
			heading: "Your pouch is...",
			note: "choose 1",
			subgroups: [{
				pickCount: 1,
				options: [
					{ slug: "origin-a", label: "Option A" },
					{ slug: "origin-b", label: "Option B" },
				],
			}],
		}],
	}],
};

describe("buildPossessionsContext — usesLabel and choiceGroups", () => {
	function makeChar() { return makeCharacter(makeActor()); }

	it("usesLabel passes through to option context", () => {
		const ctx = makeChar().buildPossessionsContext(SP_WITH_GROUPS, new Set(), {}, {});
		expect(ctx.options[0].usesLabel).toBe("Stock");
	});

	it("possession without usesLabel has usesLabel=null", () => {
		const ctx = makeChar().buildPossessionsContext(BASE_SP, new Set(), {}, {});
		expect(ctx.options[0].usesLabel).toBeNull();
	});

	it("choiceGroups is null when possession not selected", () => {
		const sp = { ...SP_WITH_GROUPS, preselected: [] };
		const ctx = makeChar().buildPossessionsContext(sp, new Set(), {}, {});
		expect(ctx.options[0].choiceGroups).toBeNull();
	});

	it("choiceGroups renders when possession is preselected", () => {
		const ctx = makeChar().buildPossessionsContext(SP_WITH_GROUPS, new Set(), {}, {});
		const cg = ctx.options[0].choiceGroups;
		expect(cg).toHaveLength(1);
		expect(cg[0].heading).toBe("Your pouch is...");
		expect(cg[0].note).toBe("choose 1");
		expect(cg[0].subgroups[0].options).toHaveLength(2);
	});

	it("choiceGroups subgroup has groupId and slugsCsv", () => {
		const ctx = makeChar().buildPossessionsContext(SP_WITH_GROUPS, new Set(), {}, {});
		const sg = ctx.options[0].choiceGroups[0].subgroups[0];
		expect(sg.groupId).toBe("pouch-cg0-sg0");
		expect(sg.slugsCsv).toBe("origin-a,origin-b");
	});

	it("choiceGroups option checked when slug is in pickedSubs", () => {
		const ctx = makeChar().buildPossessionsContext(SP_WITH_GROUPS, new Set(), {}, {}, [], { pouch: ["origin-a"] });
		const opts = ctx.options[0].choiceGroups[0].subgroups[0].options;
		expect(opts[0].checked).toBe(true);
		expect(opts[1].checked).toBe(false);
	});
});

// -- buildPossessionsContext: sub-choices ------------------------------------

const SP_WITH_CHOICES = {
	pickNote: "Pick 2",
	pickCount: 2,
	preselected: [],
	options: [
		{
			slug: "weapons-of-war",
			label: "Weapons of war",
			description: "",
			choices: {
				pickCount: 3,
				options: [
					{ slug: "sword",    label: "◇ Sword" },
					{ slug: "crossbow", label: "◇ Crossbow", uses: 2 },
					{ slug: "axe",      label: "◇ Axe" },
					{ slug: "mace",     label: "◇ Mace" },
				],
			},
		},
		{ slug: "distillery", label: "Distillery", description: "whisky", uses: 2 },
	],
};

describe("buildPossessionsContext — sub-choices", () => {
	function makeChar() { return makeCharacter(makeActor()); }

	it("choices is null when possession is not selected", () => {
		const ctx = makeChar().buildPossessionsContext(SP_WITH_CHOICES, new Set(), {}, {});
		const war = ctx.options.find(o => o.slug === "weapons-of-war");
		expect(war.choices).toBeNull();
	});

	it("choices is populated when possession is selected", () => {
		const ctx = makeChar().buildPossessionsContext(SP_WITH_CHOICES, new Set(["weapons-of-war"]), {}, {});
		const war = ctx.options.find(o => o.slug === "weapons-of-war");
		expect(war.choices).not.toBeNull();
		expect(war.choices.options).toHaveLength(4);
	});

	it("picked sub-choice is checked and not disabled", () => {
		const ctx = makeChar().buildPossessionsContext(
			SP_WITH_CHOICES, new Set(["weapons-of-war"]), {}, {}, [],
			{ "weapons-of-war": ["sword"] }, {},
		);
		const war = ctx.options.find(o => o.slug === "weapons-of-war");
		const sword = war.choices.options.find(c => c.slug === "sword");
		expect(sword.checked).toBe(true);
		expect(sword.disabled).toBe(false);
	});

	it("unpicked sub-choice under limit is not disabled", () => {
		const ctx = makeChar().buildPossessionsContext(
			SP_WITH_CHOICES, new Set(["weapons-of-war"]), {}, {}, [],
			{ "weapons-of-war": ["sword"] }, {},
		);
		const war = ctx.options.find(o => o.slug === "weapons-of-war");
		const axe = war.choices.options.find(c => c.slug === "axe");
		expect(axe.disabled).toBe(false);
	});

	it("unpicked sub-choice at pickCount limit is disabled", () => {
		const ctx = makeChar().buildPossessionsContext(
			SP_WITH_CHOICES, new Set(["weapons-of-war"]), {}, {}, [],
			{ "weapons-of-war": ["sword", "crossbow", "axe"] }, {},
		);
		const war = ctx.options.find(o => o.slug === "weapons-of-war");
		const mace = war.choices.options.find(c => c.slug === "mace");
		expect(mace.disabled).toBe(true);
	});

	it("picked sub-choice with uses produces usesChecks of correct length", () => {
		const ctx = makeChar().buildPossessionsContext(
			SP_WITH_CHOICES, new Set(["weapons-of-war"]), {}, {}, [],
			{ "weapons-of-war": ["crossbow"] }, { "weapons-of-war:crossbow": 1 },
		);
		const war = ctx.options.find(o => o.slug === "weapons-of-war");
		const crossbow = war.choices.options.find(c => c.slug === "crossbow");
		expect(crossbow.usesChecks).toHaveLength(2);
		expect(crossbow.usesChecks[0].checked).toBe(true);
		expect(crossbow.usesChecks[1].checked).toBe(false);
	});

	it("unpicked sub-choice with uses has usesChecks null", () => {
		const ctx = makeChar().buildPossessionsContext(
			SP_WITH_CHOICES, new Set(["weapons-of-war"]), {}, {}, [],
			{ "weapons-of-war": [] }, {},
		);
		const war = ctx.options.find(o => o.slug === "weapons-of-war");
		const crossbow = war.choices.options.find(c => c.slug === "crossbow");
		expect(crossbow.usesChecks).toBeNull();
	});

	it("sub-choice without uses field has usesChecks null even when picked", () => {
		const ctx = makeChar().buildPossessionsContext(
			SP_WITH_CHOICES, new Set(["weapons-of-war"]), {}, {}, [],
			{ "weapons-of-war": ["sword"] }, {},
		);
		const war = ctx.options.find(o => o.slug === "weapons-of-war");
		const sword = war.choices.options.find(c => c.slug === "sword");
		expect(sword.usesChecks).toBeNull();
	});
});
