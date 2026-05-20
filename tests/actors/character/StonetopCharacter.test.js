import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {FakeMoveRepository} from "../../fakes/FakeMoveRepository.js";
import {TestCharacterBuilder} from "../../fakes/TestCharacterBuilder.js";
import {BLESSED_PLAYBOOK, FakePlaybookRepository} from "../../fakes/FakePlaybookRepository.js";
import {FakeActorBuilder} from "../../fakes/FakeActorBuilder.js";
import {MoveDefinition} from "../../../module/model/MoveDefinition.js";

// -- buildSnapshot (playbook display fields) ----------------------------------

describe("StonetopCharacter.buildSnapshot — playbook display fields", () => {
	it("returns playbook=null with empty movelist when no playbook", async () => {
		const char = new TestCharacterBuilder(new FakeActorBuilder().build()).build();
		const data = await char.buildSnapshot();
		expect(data.playbook).toBeNull();
		expect(data.movelist.playbookMoves).toHaveLength(0);
		expect(data.movelist.basicMoves).toHaveLength(0);
	});

	it("returns movelist with otherMoves even when no playbook", async () => {
		const move = { _id: "m1", type: "move", name: "Custom Move", system: { moveType: "other", rollType: null } };
		const char = new TestCharacterBuilder(new FakeActorBuilder().withItems([move]).build()).build();
		const data = await char.buildSnapshot();
		expect(data.movelist.otherMoves).toHaveLength(1);
		expect(data.movelist.otherMoves[0].name).toBe("Custom Move");
	});

	it("returns playbook object when playbook present", async () => {
		const actor = new FakeActorBuilder().withPlaybook("the-blessed", "The Blessed").build();
		const char = new TestCharacterBuilder(actor).addPlaybook(BLESSED_PLAYBOOK).build();
		const data = await char.buildSnapshot();
		expect(data.playbook).not.toBeNull();
	});

	describe("with no saved selections", () => {
		async function buildCharacterSnapshot() {
			const actor = new FakeActorBuilder().withPlaybook("the-blessed", "The Blessed").build();
			return new TestCharacterBuilder(actor).addPlaybook(BLESSED_PLAYBOOK).build().buildSnapshot();
		}

		it("maps backgrounds, none selected", async () => {
			const data = await buildCharacterSnapshot();
			expect(data.playbook.background.options).toHaveLength(3);
			expect(data.playbook.background.options.every(b => !b.selected)).toBe(true);
		});

		it("maps instincts with value field and none selected", async () => {
			const data = await buildCharacterSnapshot();
			expect(data.playbook.instinct.options).toHaveLength(5);
			expect(data.playbook.instinct.options[0].value).toBe("Delight — To find beauty, in even the ugliest things.");
			expect(data.playbook.instinct.options.every(i => !i.selected)).toBe(true);
		});

		it("maps appearance lines with lineIdx and no selections", async () => {
			const data = await buildCharacterSnapshot();
			expect(data.playbook.appearance.options).toHaveLength(4);
			expect(data.playbook.appearance.options[0].lineIdx).toBe(0);
			expect(data.playbook.appearance.options[0].options.every(o => !o.selected)).toBe(true);
		});

		it("maps origins with none selected", async () => {
			const data = await buildCharacterSnapshot();
			expect(data.playbook.origin.options).toHaveLength(4);
			expect(data.playbook.origin.options.every(o => !o.selected)).toBe(true);
			expect(data.playbook.origin.options[0].region).toBe("Stonetop");
		});
	});

	describe("with saved selections", () => {
		async function buildCtx() {
			const actor = new FakeActorBuilder()
				.withPlaybook("the-blessed", "The Blessed")
				.withFlag("background.selected", "vessel")
				.withFlag("instinct.selected", "Delight — To find beauty, in even the ugliest things.")
				.withFlag("appearance.selected", { 0: "gray & wizened" })
				.withFlag("origin.selected", "Barrier Pass")
				.build();
			return new TestCharacterBuilder(actor).addPlaybook(BLESSED_PLAYBOOK).build().buildSnapshot();
		}

		it("marks the saved background as selected", async () => {
			const data = await buildCtx();
			expect(data.playbook.background.options.find(b => b.slug === "vessel").selected).toBe(true);
			expect(data.playbook.background.options.filter(b => b.selected)).toHaveLength(1);
		});

		it("marks the matching instinct as selected", async () => {
			const data = await buildCtx();
			expect(data.playbook.instinct.selected).toBe("Delight — To find beauty, in even the ugliest things.");
			expect(data.playbook.instinct.options.find(i => i.word === "Delight").selected).toBe(true);
		});

		it("marks saved appearance option as selected", async () => {
			const data = await buildCtx();
			expect(data.playbook.appearance.options[0].options.find(o => o.value === "gray & wizened").selected).toBe(true);
		});

		it("marks the saved origin as selected", async () => {
			const data = await buildCtx();
			expect(data.playbook.origin.options.find(o => o.region === "Barrier Pass").selected).toBe(true);
		});
	});
});

// -- buildMovelistContext -----------------------------------------------------

function makeEntry(overrides = {}) {
	return new MoveDefinition({
		_id: overrides._id ?? "abc123",
		name: overrides.name ?? "Test Move",
		system: {
			description: overrides.description ?? "A test move.",
			rollType: overrides.rollType ?? null,
			isStartingMove: overrides.isStartingMove ?? false,
			requirement: overrides.requirement ?? null,
		},
	});
}

describe("StonetopCharacter.buildMovelistContext", () => {
	const char = new TestCharacterBuilder(new FakeActorBuilder().build())
		.withPlaybookRepo(undefined)
		.withMoveRepo(undefined)
		.build();

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

	it("rollType passes through", () => {
		const [m] = char.buildMovelistContext([makeEntry({ rollType: "con" })], new Map(), new Set(), 1);
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
	const char = new TestCharacterBuilder(new FakeActorBuilder().build())
		.withPlaybookRepo(undefined)
		.withMoveRepo(undefined)
		.build();

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
		const actor = new FakeActorBuilder().build();
		const char = new TestCharacterBuilder(actor).build();
		await char.ensureStartingMoves();
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("adds missing starting moves", async () => {
		const actor = new FakeActorBuilder().withPlaybook("the-blessed", "The Blessed").build();
		const char = new TestCharacterBuilder(actor)
			.addPlaybook(BLESSED_PLAYBOOK)
			.addPlaybookMove(makeMoveEntry("Rites of the Land", true, "id1"))
			.build();
		await char.ensureStartingMoves();
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [{ name: "Rites of the Land" }]);
	});

	it("does not add moves the actor already owns", async () => {
		const actor = new FakeActorBuilder()
			.withPlaybook("the-blessed", "The Blessed")
			.withItems([{ type: "move", name: "Rites of the Land" }])
			.build();
		const entries = [makeMoveEntry("Rites of the Land", true, "id1")];
		const char = new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(BLESSED_PLAYBOOK))
			.withMoveRepo(new FakeMoveRepository(entries, []))
			.build();
		await char.ensureStartingMoves();
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("adds background-specific moves based on selected background", async () => {
		const actor = new FakeActorBuilder()
			.withPlaybook("the-blessed", "The Blessed")
			.withFlag("background.selected", "initiate")
			.build();
		const entries = [makeMoveEntry("Rites of the Land", false, "id1")];
		const char = new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(BLESSED_PLAYBOOK))
			.withMoveRepo(new FakeMoveRepository(entries, []))
			.build();
		await char.ensureStartingMoves();
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [{ name: "Rites of the Land" }]);
	});
});

// -- computePossessionMaxUses -------------------------------------------------

const SP_BONUS = {
	options: [{
		slug: "sacred-pouch",
		resource: { max: 3, title: "Stock", labels: [] },
		usesBonus: {
			evenLevelBonus: 1,
			moveBonus: [{ moveName: "Big Magic", perInstance: 2 }],
		},
	}],
};

describe("StonetopCharacter.computePossessionMaxUses", () => {
	function makeChar() {
		return new TestCharacterBuilder(new FakeActorBuilder().build())
			.withPlaybookRepo(undefined)
			.withMoveRepo(undefined)
			.build();
	}

	it("no moves owned, level 1 → no entry (base uses unchanged)", () => {
		const result = makeChar().computePossessionMaxUses(SP_BONUS, new Map(), 1);
		expect(result["sacred-pouch"]).toBeUndefined();
	});

	it("level 2 → +1 from even level", () => {
		const result = makeChar().computePossessionMaxUses(SP_BONUS, new Map(), 2);
		expect(result["sacred-pouch"]).toBe(4);
	});

	it("level 4 → +2 from two even levels", () => {
		const result = makeChar().computePossessionMaxUses(SP_BONUS, new Map(), 4);
		expect(result["sacred-pouch"]).toBe(5);
	});

	it("Big Magic owned once → +2", () => {
		const owned = new Map([["Big Magic", [{ _id: "bm1" }]]]);
		const result = makeChar().computePossessionMaxUses(SP_BONUS, owned, 1);
		expect(result["sacred-pouch"]).toBe(5);
	});

	it("Big Magic owned twice → +4", () => {
		const owned = new Map([["Big Magic", [{ _id: "bm1" }, { _id: "bm2" }]]]);
		const result = makeChar().computePossessionMaxUses(SP_BONUS, owned, 1);
		expect(result["sacred-pouch"]).toBe(7);
	});

	it("Big Magic once + level 4 → +2 move + +2 level = base 3 + 4", () => {
		const owned = new Map([["Big Magic", [{ _id: "bm1" }]]]);
		const result = makeChar().computePossessionMaxUses(SP_BONUS, owned, 4);
		expect(result["sacred-pouch"]).toBe(7);
	});

	it("possession without usesBonus is not affected", () => {
		const sp = { options: [{ slug: "apiary" }] };
		const result = makeChar().computePossessionMaxUses(sp, new Map(), 10);
		expect(result["apiary"]).toBeUndefined();
	});
});

// -- buildPossessionsContext --------------------------------------------------

const BASE_SP = {
	pickNote: "Pick 2",
	pickCount: 2,
	preselected: ["sacred-pouch"],
	options: [
		{ slug: "sacred-pouch", label: "Sacred pouch", description: "a magical pouch", resource: { max: 3, title: null, labels: [] } },
		{ slug: "apiary",       label: "Apiary",        description: "bees" },
		{ slug: "mastiffs",     label: "Mastiffs",      description: "dogs" },
		{ slug: "herb-garden",  label: "Herb garden",   description: "herbs" },
	],
};

describe("buildPossessionsContext", () => {
	function makeChar() {
		return new TestCharacterBuilder(new FakeActorBuilder().build()).build();
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
		resource: { max: 3, title: "Stock", labels: [] },
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
	function makeChar() {
		return new TestCharacterBuilder(new FakeActorBuilder().build())
			.withPlaybookRepo(undefined)
			.withMoveRepo(undefined)
			.build();
	}

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
					{ slug: "crossbow", label: "◇ Crossbow", resource: { max: 2, title: null, labels: [] } },
					{ slug: "axe",      label: "◇ Axe" },
					{ slug: "mace",     label: "◇ Mace" },
				],
			},
		},
		{ slug: "distillery", label: "Distillery", description: "whisky", resource: { max: 2, title: null, labels: [] } },
	],
};

describe("buildPossessionsContext — sub-choices", () => {
	function makeChar() {
		return new TestCharacterBuilder(new FakeActorBuilder().build())
			.withPlaybookRepo(undefined)
			.withMoveRepo(undefined)
			.build();
	}

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

// -- applyDebilityRollMode ----------------------------------------------------

function makeDebilityActor({ weakened = false, dazed = false, miserable = false } = {}) {
	return new FakeActorBuilder()
		.withDebility("weakened", weakened)
		.withDebility("dazed", dazed)
		.withDebility("miserable", miserable)
		.build();
}

describe("applyDebilityRollMode", () => {
	it("no debility active — passes rollMode def through unchanged", () => {
		const char = new TestCharacterBuilder(makeDebilityActor()).build();
		expect(char.applyDebilityRollMode("str", { rollMode: "def" })).toEqual({ rollMode: "def" });
	});

	it("no debility active — passes rollMode adv through unchanged", () => {
		const char = new TestCharacterBuilder(makeDebilityActor()).build();
		expect(char.applyDebilityRollMode("str", { rollMode: "adv" })).toEqual({ rollMode: "adv" });
	});

	it("debility active, stat affected, rollMode def → dis", () => {
		const char = new TestCharacterBuilder(makeDebilityActor({weakened: true})).build();
		expect(char.applyDebilityRollMode("str", { rollMode: "def" })).toEqual({ rollMode: "dis" });
	});

	it("debility active, stat affected, rollMode adv → def (cancel)", () => {
		const char = new TestCharacterBuilder(makeDebilityActor({weakened: true})).build();
		expect(char.applyDebilityRollMode("str", { rollMode: "adv" })).toEqual({ rollMode: "def" });
	});

	it("debility active, stat affected, rollMode dis → dis (unchanged)", () => {
		const char = new TestCharacterBuilder(makeDebilityActor({weakened: true})).build();
		expect(char.applyDebilityRollMode("str", { rollMode: "dis" })).toEqual({ rollMode: "dis" });
	});

	it("debility active but for a different stat — passes through unchanged", () => {
		const char = new TestCharacterBuilder(makeDebilityActor({weakened: true})).build();
		expect(char.applyDebilityRollMode("int", { rollMode: "def" })).toEqual({ rollMode: "def" });
	});

	it("debility value false (unchecked) — passes through unchanged", () => {
		const char = new TestCharacterBuilder(makeDebilityActor({weakened: false})).build();
		expect(char.applyDebilityRollMode("str", { rollMode: "def" })).toEqual({ rollMode: "def" });
	});

	it("two debilities active, one covers stat, rollMode adv → def", () => {
		const char = new TestCharacterBuilder(makeDebilityActor({weakened: true, dazed: true})).build();
		expect(char.applyDebilityRollMode("str", { rollMode: "adv" })).toEqual({ rollMode: "def" });
	});

	it("dazed covers int and wis, rollMode def → dis for int", () => {
		const char = new TestCharacterBuilder(makeDebilityActor({dazed: true})).build();
		expect(char.applyDebilityRollMode("int", { rollMode: "def" })).toEqual({ rollMode: "dis" });
		expect(char.applyDebilityRollMode("wis", { rollMode: "def" })).toEqual({ rollMode: "dis" });
	});

	it("preserves other options fields while changing rollMode", () => {
		const char = new TestCharacterBuilder(makeDebilityActor({weakened: true})).build();
		const result = char.applyDebilityRollMode("str", { rollMode: "adv", extra: "value" });
		expect(result).toEqual({ rollMode: "def", extra: "value" });
	});
});

// -- getMoves (otherMoves) ----------------------------------------------------

describe("StonetopCharacter.getMoves otherMoves", () => {
	it("returns otherMoves: [] when no moves have moveType 'other'", async () => {
		const char = new TestCharacterBuilder(new FakeActorBuilder().build()).build();
		const result = await char.getMoves();
		expect(result.otherMoves).toEqual([]);
	});

	it("returns otherMoves populated with items that have moveType 'other'", async () => {
		const move = { _id: "m1", type: "move", name: "Custom Move", system: { moveType: "other", rollType: "str", description: "<p>Do a thing.</p>" } };
		const char = new TestCharacterBuilder(new FakeActorBuilder().withItems([move]).build()).build();
		const result = await char.getMoves();
		expect(result.otherMoves).toEqual([{ name: "Custom Move", ownedId: "m1", rollType: "str", description: "<p>Do a thing.</p>" }]);
	});

	it("does not include items with other moveTypes in otherMoves", async () => {
		const move = { _id: "m2", type: "move", name: "Special Move", system: { moveType: "special", rollType: null } };
		const char = new TestCharacterBuilder(new FakeActorBuilder().withItems([move]).build()).build();
		const result = await char.getMoves();
		expect(result.otherMoves).toEqual([]);
	});

	it("includes cross-playbook moves (name not in current playbook) in otherMoves", async () => {
		const move = { _id: "m4", type: "move", name: "Fox Move", system: { moveType: "playbook", rollType: null, description: null } };
		const actor = new FakeActorBuilder()
			.withPlaybook("the-blessed", "The Blessed")
			.withItems([move])
			.build();
		const char = new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(BLESSED_PLAYBOOK))
			.withMoveRepo(new FakeMoveRepository([], []))
			.build();
		const result = await char.getMoves();
		expect(result.otherMoves).toEqual([{ name: "Fox Move", ownedId: "m4", rollType: null, description: null }]);
	});

	it("does not include same-playbook moves in otherMoves", async () => {
		const move = { _id: "m5", type: "move", name: "Blessed Move", system: { moveType: "playbook", rollType: null } };
		const playbookEntry = { _id: "pm1", name: "Blessed Move", system: { moveType: "playbook", isStartingMove: false } };
		const actor = new FakeActorBuilder()
			.withPlaybook("the-blessed", "The Blessed")
			.withItems([move])
			.build();
		const char = new TestCharacterBuilder(actor)
			.withPlaybookRepo(new FakePlaybookRepository(BLESSED_PLAYBOOK))
			.withMoveRepo(new FakeMoveRepository([playbookEntry], []))
			.build();
		const result = await char.getMoves();
		expect(result.otherMoves).toEqual([]);
	});

	it("includes description: null when item has no description", async () => {
		const move = { _id: "m3", type: "move", name: "Bare Move", system: { moveType: "other", rollType: null } };
		const char = new TestCharacterBuilder(new FakeActorBuilder().withItems([move]).build()).build();
		const result = await char.getMoves();
		expect(result.otherMoves[0].description).toBeNull();
	});
});

// -- getMoves resourceChecks --------------------------------------------------

describe("StonetopCharacter.getMoves resourceChecks", () => {
	function makeBlessedActor() {
		return new FakeActorBuilder().withPlaybook("the-blessed", "The Blessed").build();
	}

	it("builds resourceChecks with label: null when move has resource with empty labels", async () => {
		const entry = { _id: "rc1", name: "Favor Move", system: { moveType: "playbook", isStartingMove: false, resource: { max: 3, title: null, labels: [] } } };
		const char = new TestCharacterBuilder(makeBlessedActor())
			.withPlaybookRepo(new FakePlaybookRepository(BLESSED_PLAYBOOK))
			.withMoveRepo(new FakeMoveRepository([entry], []))
			.build();
		const result = await char.getMoves();
		const move = result.playbookMoves.find(m => m.name === "Favor Move");
		expect(move.resourceChecks).toEqual([
			{ checked: false, label: null },
			{ checked: false, label: null },
			{ checked: false, label: null },
		]);
	});

	it("builds resourceChecks with labels when move has resource.labels", async () => {
		const entry = { _id: "rc2", name: "Blade Move", system: { moveType: "playbook", isStartingMove: false, resource: { max: 2, title: null, labels: ["a few left", "out"] } } };
		const char = new TestCharacterBuilder(makeBlessedActor())
			.withPlaybookRepo(new FakePlaybookRepository(BLESSED_PLAYBOOK))
			.withMoveRepo(new FakeMoveRepository([entry], []))
			.build();
		const result = await char.getMoves();
		const move = result.playbookMoves.find(m => m.name === "Blade Move");
		expect(move.resourceChecks).toEqual([
			{ checked: false, label: "a few left" },
			{ checked: false, label: "out" },
		]);
	});

	it("resource.max determines resourceChecks length", async () => {
		const entry = { _id: "rc3", name: "State Move", system: { moveType: "playbook", isStartingMove: false, resource: { max: 3, title: null, labels: ["fresh", "spent", "gone"] } } };
		const char = new TestCharacterBuilder(makeBlessedActor())
			.withPlaybookRepo(new FakePlaybookRepository(BLESSED_PLAYBOOK))
			.withMoveRepo(new FakeMoveRepository([entry], []))
			.build();
		const result = await char.getMoves();
		const move = result.playbookMoves.find(m => m.name === "State Move");
		expect(move.resourceChecks).toHaveLength(3);
	});
});

// -- onRoll -------------------------------------------------------------------

function makeRollableItem({ id = "item-1", rollType = "str", type = "move", rollFormula = null } = {}) {
	return {
		_id: id,
		type,
		system: { rollType, rollFormula },
		roll: vi.fn(),
	};
}

function makeItemEvent({ itemId = "item-1", showDescription = false, hasItemEl = true } = {}) {
	return {
		currentTarget: {
			closest: (sel) => sel === ".item" && hasItemEl ? { dataset: { itemId } } : null,
			getAttribute: (attr) => attr === "data-show" && showDescription ? "description" : null,
			classList: { contains: () => false },
			dataset: {},
		},
	};
}

function makeOnRollActor(item, { pbtaRollMode = "def", debilities = {} } = {}) {
	const actor = new FakeActorBuilder()
		.withDebility("weakened",  debilities.weakened  ?? false)
		.withDebility("dazed",     debilities.dazed     ?? false)
		.withDebility("miserable", debilities.miserable ?? false)
		.withRollMode(pbtaRollMode)
		.build();
	const itemsArr = item ? [item] : [];
	itemsArr.get = (id) => itemsArr.find(i => i._id === id) ?? null;
	actor.items = itemsArr;
	return actor;
}

// -- onDropMove ---------------------------------------------------------------

function makeDropMoveActor({ items = [], playbook = null } = {}) {
	return new FakeActorBuilder()
		.withPlaybook(null, playbook)
		.withItems(items)
		.build();
}

describe("StonetopCharacter.onDropMove", () => {
	it("returns false and skips creation when a move with the same name is already owned", async () => {
		const existing = { type: "move", name: "Barkskin" };
		const actor = makeDropMoveActor({ items: [existing] });
		const char = new TestCharacterBuilder(actor).build();
		const result = await char.onDropMove({ name: "Barkskin", type: "move", system: { moveType: "playbook", playbook: "The Blessed" } });
		expect(result).toBe(false);
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("returns true and creates same-playbook move as-is", async () => {
		const actor = makeDropMoveActor({ playbook: "The Blessed" });
		const char = new TestCharacterBuilder(actor).build();
		const itemData = { name: "Barkskin", type: "move", system: { moveType: "playbook", playbook: "The Blessed" } };
		const result = await char.onDropMove(itemData);
		expect(result).toBe(true);
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [
			expect.objectContaining({ system: expect.objectContaining({ moveType: "playbook" }) }),
		]);
	});

	it("returns true and changes moveType to 'other' for cross-playbook moves", async () => {
		const actor = makeDropMoveActor({ playbook: "The Fox" });
		const char = new TestCharacterBuilder(actor).build();
		const itemData = { name: "Barkskin", type: "move", system: { moveType: "playbook", playbook: "The Blessed" } };
		const result = await char.onDropMove(itemData);
		expect(result).toBe(true);
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [
			expect.objectContaining({ system: expect.objectContaining({ moveType: "other" }) }),
		]);
	});

	it("returns true and creates other-moveType moves without changing moveType", async () => {
		const actor = makeDropMoveActor({ playbook: "The Fox" });
		const char = new TestCharacterBuilder(actor).build();
		const itemData = { name: "Some Follower Move", type: "move", system: { moveType: "follower", playbook: null } };
		const result = await char.onDropMove(itemData);
		expect(result).toBe(true);
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [
			expect.objectContaining({ system: expect.objectContaining({ moveType: "follower" }) }),
		]);
	});
});

describe("StonetopCharacter.onRoll", () => {
	beforeEach(() => { game.settings = { get: vi.fn(() => false) }; });
	afterEach(() => { delete game.settings; });

	it("returns false when event has no item element", async () => {
		const char = new TestCharacterBuilder(makeOnRollActor(null)).build();
		expect(await char.onRoll(makeItemEvent({ hasItemEl: false }))).toBe(false);
	});

	it("returns false when item has no rollType", async () => {
		const item = makeRollableItem({ rollType: null });
		const char = new TestCharacterBuilder(makeOnRollActor(item)).build();
		expect(await char.onRoll(makeItemEvent())).toBe(false);
		expect(item.roll).not.toHaveBeenCalled();
	});

	it("returns true and calls item.roll when item has a rollType", async () => {
		const item = makeRollableItem({ rollType: "str" });
		const char = new TestCharacterBuilder(makeOnRollActor(item)).build();
		expect(await char.onRoll(makeItemEvent())).toBe(true);
		expect(item.roll).toHaveBeenCalledOnce();
	});

	it("passes rollMode from actor pbta flag", async () => {
		const item = makeRollableItem({ rollType: "str" });
		const char = new TestCharacterBuilder(makeOnRollActor(item, {pbtaRollMode: "adv"})).build();
		expect(await char.onRoll(makeItemEvent())).toBe(true);
		expect(item.roll).toHaveBeenCalledWith(expect.objectContaining({ rollMode: "adv" }));
	});

	it("sets descriptionOnly when data-show=description", async () => {
		const item = makeRollableItem({ rollType: "str" });
		const char = new TestCharacterBuilder(makeOnRollActor(item)).build();
		expect(await char.onRoll(makeItemEvent({ showDescription: true }))).toBe(true);
		expect(item.roll).toHaveBeenCalledWith(expect.objectContaining({ descriptionOnly: true }));
	});

	it("sets descriptionOnly for npcMove with no rollFormula", async () => {
		const item = makeRollableItem({ rollType: "str", type: "npcMove", rollFormula: null });
		const char = new TestCharacterBuilder(makeOnRollActor(item)).build();
		expect(await char.onRoll(makeItemEvent())).toBe(true);
		expect(item.roll).toHaveBeenCalledWith(expect.objectContaining({ descriptionOnly: true }));
	});

	it("applies disadvantage when relevant debility is active", async () => {
		const item = makeRollableItem({ rollType: "str" });
		const char = new TestCharacterBuilder(makeOnRollActor(item, {debilities: {weakened: true}})).build();
		expect(await char.onRoll(makeItemEvent())).toBe(true);
		expect(item.roll).toHaveBeenCalledWith(expect.objectContaining({ rollMode: "dis" }));
	});

	it("does not apply disadvantage when debility covers a different stat", async () => {
		const item = makeRollableItem({ rollType: "wis" });
		const char = new TestCharacterBuilder(makeOnRollActor(item, {debilities: {weakened: true}})).build();
		expect(await char.onRoll(makeItemEvent())).toBe(true);
		expect(item.roll).toHaveBeenCalledWith(expect.objectContaining({ rollMode: "def" }));
	});

	it("omits rollMode from options when hideRollMode is true", async () => {
		game.settings.get.mockReturnValue(true);
		const item = makeRollableItem({ rollType: "str" });
		const char = new TestCharacterBuilder(makeOnRollActor(item, {pbtaRollMode: "adv"})).build();
		expect(await char.onRoll(makeItemEvent())).toBe(true);
		expect(item.roll).toHaveBeenCalledWith({ descriptionOnly: false });
	});
});
