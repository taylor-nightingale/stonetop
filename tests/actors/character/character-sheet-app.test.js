import { describe, it, expect, vi } from "vitest";
import { buildSheetContext, buildMovelistContext, createStonetopCharacterSheetClass } from "../../../module/actors/character/character-sheet-app.js";

// -- buildSheetContext ----------------------------------------------------

const BLESSED_FLAGS = {
	backgrounds: [
		{ slug: "initiate",         label: "Initiate",         description: "<p>Initiate desc.</p>", moves: ["Rites of the Land"] },
		{ slug: "raised-by-wolves", label: "Raised by Wolves", description: "<p>Wolves desc.</p>",   moves: ["Trackless Step"] },
		{ slug: "vessel",           label: "Vessel",           description: "<p>Vessel desc.</p>",   moves: ["Danu's Grasp"] },
	],
	instincts: [
		{ word: "Delight",     description: "To find beauty, in even the ugliest things." },
		{ word: "Detachment",  description: "To remain unmoved, to be cold as winter." },
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
};

describe("buildSheetContext", () => {
	it("returns empty arrays and hasPlaybook=false when flags are null", () => {
		const ctx = buildSheetContext(null);
		expect(ctx.hasPlaybook).toBe(false);
		expect(ctx.backgrounds).toHaveLength(0);
		expect(ctx.instincts).toHaveLength(0);
		expect(ctx.appearance).toHaveLength(0);
		expect(ctx.origins).toHaveLength(0);
		expect(ctx.savedInstinct).toBe("");
	});

	it("sets hasPlaybook=true when flags are present", () => {
		expect(buildSheetContext(BLESSED_FLAGS, {}).hasPlaybook).toBe(true);
	});

	describe("with no saved selections", () => {
		const ctx = buildSheetContext(BLESSED_FLAGS, {});

		it("maps backgrounds, none selected", () => {
			expect(ctx.backgrounds).toHaveLength(3);
			expect(ctx.backgrounds.every(b => !b.selected)).toBe(true);
		});

		it("maps instincts with value field and none selected", () => {
			expect(ctx.instincts).toHaveLength(3);
			expect(ctx.instincts[0].value).toBe("Delight — To find beauty, in even the ugliest things.");
			expect(ctx.instincts.every(i => !i.selected)).toBe(true);
		});

		it("maps appearance lines with lineIdx and no selections", () => {
			expect(ctx.appearance).toHaveLength(2);
			expect(ctx.appearance[0].lineIdx).toBe(0);
			expect(ctx.appearance[1].lineIdx).toBe(1);
			expect(ctx.appearance[0].options.every(o => !o.selected)).toBe(true);
		});

		it("maps origins with none selected", () => {
			expect(ctx.origins).toHaveLength(2);
			expect(ctx.origins.every(o => !o.selected)).toBe(true);
			expect(ctx.origins[0].region).toBe("Stonetop");
			expect(ctx.origins[0].names).toEqual(["Arwel", "Blodwen"]);
		});
	});

	describe("with saved selections", () => {
		const saved = {
			background: "vessel",
			instinct: "Delight — To find beauty, in even the ugliest things.",
			appearance: { 0: "gray & wizened" },
			origin: "Barrier Pass",
		};
		const ctx = buildSheetContext(BLESSED_FLAGS, saved);

		it("marks the saved background as selected", () => {
			expect(ctx.backgrounds.find(b => b.slug === "vessel").selected).toBe(true);
			expect(ctx.backgrounds.filter(b => b.selected)).toHaveLength(1);
		});

		it("marks the matching instinct as selected and sets savedInstinct", () => {
			expect(ctx.savedInstinct).toBe("Delight — To find beauty, in even the ugliest things.");
			expect(ctx.instincts.find(i => i.word === "Delight").selected).toBe(true);
			expect(ctx.instincts.filter(i => i.selected)).toHaveLength(1);
		});

		it("marks saved appearance option as selected", () => {
			const line0 = ctx.appearance[0];
			expect(line0.options.find(o => o.value === "gray & wizened").selected).toBe(true);
			expect(line0.options.filter(o => o.selected)).toHaveLength(1);
		});

		it("leaves unsaved appearance lines with no selection", () => {
			expect(ctx.appearance[1].options.every(o => !o.selected)).toBe(true);
		});

		it("marks the saved origin as selected", () => {
			expect(ctx.origins.find(o => o.region === "Barrier Pass").selected).toBe(true);
			expect(ctx.origins.filter(o => o.selected)).toHaveLength(1);
		});
	});
});

// -- createStonetopCharacterSheetClass event handlers ---------------------

function makeActor(flags = {}, updates = []) {
	const flagStore = { stonetop: { ...flags } };
	return {
		updates,
		flags: flagStore,
		getFlag: (scope, key) => flagStore[scope]?.[key] ?? null,
		setFlag: vi.fn(async (scope, key, val) => { flagStore[scope] ??= {}; flagStore[scope][key] = val; }),
		update: vi.fn(async data => updates.push(data)),
	};
}

function makeSheet(actor) {
	const Base = class {
		constructor() { this._actor = actor; }
		get actor() { return this._actor; }
		get isEditable() { return true; }
		async getData() { return {}; }
		activateListeners() {}
	};
	const Sheet = createStonetopCharacterSheetClass(Base);
	return new Sheet();
}

describe("StonetopCharacterSheet event handlers", () => {
	it("_onBackgroundChange saves the slug flag", async () => {
		const actor = makeActor({ background: "" });
		const sheet = makeSheet(actor);
		await sheet._onBackgroundChange({ currentTarget: { value: "vessel" } });
		expect(actor.setFlag).toHaveBeenCalledWith("stonetop", "background", "vessel");
	});

	it("_onAppearanceChange merges the selected option into saved appearance", async () => {
		const actor = makeActor({ appearance: { 1: "strapping" } });
		const sheet = makeSheet(actor);
		await sheet._onAppearanceChange({ currentTarget: { dataset: { line: "0" }, value: "gray & wizened" } });
		expect(actor.setFlag).toHaveBeenCalledWith("stonetop", "appearance", { 1: "strapping", 0: "gray & wizened" });
	});

	it("_onOriginNameClick updates the actor name", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		await sheet._onOriginNameClick({ currentTarget: { textContent: "  Arwel  " } });
		expect(actor.update).toHaveBeenCalledWith({ name: "Arwel" });
	});
});

// -- buildMovelistContext -------------------------------------------------

function makeEntry(overrides = {}) {
	return {
		_id: overrides._id ?? "abc123",
		name: overrides.name ?? "Test Move",
		system: {
			description: overrides.description ?? "A test move.",
			stat: overrides.stat ?? null,
			isStartingMove: overrides.isStartingMove ?? false,
			requires: overrides.requires ?? null,
			minLevel: overrides.minLevel ?? null,
		},
	};
}

describe("buildMovelistContext", () => {
	it("returns empty array for empty entries", () => {
		expect(buildMovelistContext([], new Map(), new Set(), 1)).toHaveLength(0);
	});

	it("unowned move with no lock: owned=false, locked=false", () => {
		const [m] = buildMovelistContext([makeEntry()], new Map(), new Set(), 1);
		expect(m.owned).toBe(false);
		expect(m.locked).toBe(false);
		expect(m.ownedId).toBeNull();
	});

	it("owned move: owned=true, ownedId set", () => {
		const entry = makeEntry({ name: "Bulwark" });
		const owned = { _id: "item-xyz" };
		const [m] = buildMovelistContext([entry], new Map([["Bulwark", owned]]), new Set(), 1);
		expect(m.owned).toBe(true);
		expect(m.ownedId).toBe("item-xyz");
	});

	it("isStartingMove: isStarting=true, locked=false", () => {
		const entry = makeEntry({ isStartingMove: true });
		const [m] = buildMovelistContext([entry], new Map(), new Set(), 1);
		expect(m.isStarting).toBe(true);
		expect(m.locked).toBe(false);
	});

	it("background move name in bgMoveNames: isStarting=true", () => {
		const entry = makeEntry({ name: "Trackless Step" });
		const [m] = buildMovelistContext([entry], new Map(), new Set(["Trackless Step"]), 1);
		expect(m.isStarting).toBe(true);
		expect(m.locked).toBe(false);
	});

	it("requires a move not owned: locked=true", () => {
		const entry = makeEntry({ requires: "Glorious Servant" });
		const [m] = buildMovelistContext([entry], new Map(), new Set(), 1);
		expect(m.locked).toBe(true);
	});

	it("requires a move that IS owned: locked=false", () => {
		const entry = makeEntry({ requires: "Glorious Servant" });
		const ownedBy = new Map([["Glorious Servant", { _id: "gs-id" }]]);
		const [m] = buildMovelistContext([entry], ownedBy, new Set(), 1);
		expect(m.locked).toBe(false);
	});

	it("minLevel above actor level: locked=true", () => {
		const entry = makeEntry({ minLevel: 6 });
		const [m] = buildMovelistContext([entry], new Map(), new Set(), 1);
		expect(m.locked).toBe(true);
	});

	it("minLevel at or below actor level: locked=false", () => {
		const entry = makeEntry({ minLevel: 3 });
		const [m] = buildMovelistContext([entry], new Map(), new Set(), 3);
		expect(m.locked).toBe(false);
	});

	it("stat field maps to rollType", () => {
		const entry = makeEntry({ stat: "con" });
		const [m] = buildMovelistContext([entry], new Map(), new Set(), 1);
		expect(m.rollType).toBe("con");
	});

	it("starting move with requires is NOT locked (isStarting overrides)", () => {
		const entry = makeEntry({ isStartingMove: true, requires: "Some Move" });
		const [m] = buildMovelistContext([entry], new Map(), new Set(), 1);
		expect(m.isStarting).toBe(true);
		expect(m.locked).toBe(false);
	});
});
