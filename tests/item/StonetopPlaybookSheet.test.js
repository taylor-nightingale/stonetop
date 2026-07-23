// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { createStonetopPlaybookSheetClass } from "../../src/item/StonetopPlaybookSheet.js";

// Drives the real sheet: _prepareContext (slug/introductions seeding, reference resolution, choice-
// group row building) and the _onRender edit wiring. The V2 base, the item document, and the
// compendium packs (via game) are mocked; the pure edit helpers and repositories run for real.

function expandSystem(patch) {
	const out = {};
	for (const [k, v] of Object.entries(patch)) if (k.startsWith("system.")) out[k.slice(7)] = v;
	return out;
}

function makeItem(system = {}, { name = "The Blessed", img = "x.png" } = {}) {
	const item = {
		name, img,
		system: { damage: { value: null }, ...system },
		getRollData: () => ({}),
		update: vi.fn(async patch => {
			for (const [k, v] of Object.entries(expandSystem(patch))) foundry.utils.setProperty(item.system, k, v);
		}),
	};
	return item;
}

function makeSheet(item, { editable = true } = {}) {
	const Base = class {
		get item() { return item; }
		get isEditable() { return editable; }
		async _prepareContext() { return {}; }
		_onRender() {}
		element = document.createElement("form");
		render = vi.fn();
	};
	return new (createStonetopPlaybookSheetClass(Base))();
}

function pack(entries) {
	return { getIndex: vi.fn(async () => {}), index: entries, folders: [] };
}

function stubGame(packsByName = {}, worldItems = []) {
	global.game = {
		i18n: global.game?.i18n,
		packs: { get: name => packsByName[name] ?? null },
		items: { contents: worldItems, get: id => worldItems.find(i => i._id === id) ?? null },
	};
}

const PACKS = {
	"stonetop.moves":       pack([{ _id: "m1", name: "Rites of the Land", system: { slug: "rites-of-the-land" } }]),
	"stonetop.followers":   pack([{ _id: "f1", name: "Crew", system: { slug: "crew" } }]),
	"stonetop.inserts":     pack([{ _id: "i1", name: "Invocations", system: { slug: "invocations" } }]),
	"stonetop.possessions": pack([{ _id: "p1", name: "Sacred Pouch", system: { slug: "sacred-pouch" } }]),
};

const FULL = {
	slug: "the-blessed",
	description: "Danu provides.",
	hp: 18,
	damage: { value: "d6" },
	backgrounds: [{ slug: "initiate", label: "Initiate", description: "desc", moves: ["rites-of-the-land"], choices: { slug: "initiate", list: [] } }],
	origin: [{ region: "Stonetop", names: ["Arwel", "Blodwen"] }],
	instinct: { slug: "instinct", list: [{ type: "pick", pickCount: 1, options: [{ slug: "delight", text: "Delight" }] }] },
	appearance: { slug: "appearance", list: [{ type: "pick", options: [{ slug: "fresh", text: "fresh-faced" }] }] },
	choices: [{ slug: "sacred-pouch", list: [] }],
	specialPossessions: { slugs: ["sacred-pouch"], pickCount: 2, pickNote: "Pick 1", preselected: ["sacred-pouch"] },
	moves: ["rites-of-the-land", "unknown-move"],
	startingMoves: ["rites-of-the-land"],
	followers: ["crew"],
	inserts: ["invocations"],
	introductions: { step3: "intro", step4: { slug: "intro-npc", list: [] }, step6: null },
};

afterEach(() => { global.game = { i18n: global.game?.i18n }; });

describe("StonetopPlaybookSheet._prepareContext — seeding", () => {
	it("seeds a stable slug and an introductions object for a blank editable playbook", async () => {
		stubGame();
		const item = makeItem();
		await makeSheet(item)._prepareContext({});
		expect(item.system.slug).toMatch(/^custom-playbook-/);
		expect(item.system.introductions).toEqual({ step3: "" });
	});

	it("never writes to a locked (non-editable) playbook", async () => {
		stubGame();
		const item = makeItem();
		await makeSheet(item, { editable: false })._prepareContext({});
		expect(item.update).not.toHaveBeenCalled();
	});

	it("preserves an existing slug and introductions", async () => {
		stubGame(PACKS);
		const item = makeItem(FULL);
		await makeSheet(item)._prepareContext({});
		expect(item.update).not.toHaveBeenCalled();
	});
});

describe("StonetopPlaybookSheet._prepareContext — reference resolution & rows", () => {
	async function ctx() {
		stubGame(PACKS);
		return makeSheet(makeItem(FULL))._prepareContext({});
	}

	it("resolves move names and flags unknown slugs missing, marking the starting subset", async () => {
		const c = await ctx();
		expect(c.playbookMoves).toEqual([
			{ slug: "rites-of-the-land", name: "Rites of the Land", missing: false, starting: true },
			{ slug: "unknown-move", name: "unknown-move", missing: true, starting: false },
		]);
	});

	it("resolves follower and insert grant names", async () => {
		const c = await ctx();
		expect(c.followers).toEqual([{ slug: "crew", name: "Crew", missing: false }]);
		expect(c.inserts).toEqual([{ slug: "invocations", name: "Invocations", missing: false }]);
	});

	it("resolves possessions with the preselected flag and pick note/count", async () => {
		const c = await ctx();
		expect(c.hasPossessions).toBe(true);
		expect(c.possessions.pickCount).toBe(2);
		expect(c.possessions.pickNote).toBe("Pick 1");
		expect(c.possessions.items).toEqual([{ slug: "sacred-pouch", name: "Sacred Pouch", missing: false, preselected: true }]);
	});

	it("builds background rows: resolved moves, choice cgPath, and description", async () => {
		const c = await ctx();
		expect(c.backgrounds[0].label).toBe("Initiate");
		expect(c.backgrounds[0].moves).toEqual([{ slug: "rites-of-the-land", name: "Rites of the Land", missing: false }]);
		expect(c.backgrounds[0].hasChoices).toBe(true);
		expect(c.backgrounds[0].cgPath).toBe("system.backgrounds.0.choices");
	});

	it("joins origin names by newline and exposes the region", async () => {
		const c = await ctx();
		expect(c.origin).toEqual([{ index: 0, region: "Stonetop", names: "Arwel\nBlodwen" }]);
	});

	it("edits instinct as a string list and appearance/choices as choice groups", async () => {
		const c = await ctx();
		expect(c.instinctStrings).toEqual(["Delight"]);
		expect(c.hasAppearance).toBe(true);
		expect(c.choicesGroups[0].cgPath).toBe("system.choices.0");
	});

	it("exposes introductions step3 text and which step groups exist", async () => {
		const c = await ctx();
		expect(c.introductions.step3).toBe("intro");
		expect(c.introductions.hasStep4).toBe(true);
		expect(c.introductions.hasStep6).toBe(false);
	});
});

describe("StonetopPlaybookSheet._onRender — edit wiring", () => {
	function editSheet(system) {
		const item  = makeItem(system);
		const sheet = makeSheet(item);
		return { item, sheet };
	}
	function render(sheet, html) {
		sheet.element.innerHTML = html;
		sheet._onRender({}, {});
	}

	it("removes a move from both moves and startingMoves", () => {
		const { item, sheet } = editSheet({ moves: ["a", "b"], startingMoves: ["a"] });
		render(sheet, `<button class="playbook-move-remove" data-slug="a"></button>`);
		sheet.element.querySelector(".playbook-move-remove").click();
		expect(item.update).toHaveBeenCalledWith({ "system.moves": ["b"], "system.startingMoves": [] });
	});

	it("toggles a move into the starting subset", () => {
		const { item, sheet } = editSheet({ moves: ["a"], startingMoves: [] });
		render(sheet, `<input type="checkbox" class="playbook-move-starting" data-slug="a">`);
		const cb = sheet.element.querySelector(".playbook-move-starting");
		cb.checked = true;
		cb.dispatchEvent(new Event("change"));
		expect(item.update).toHaveBeenCalledWith({ "system.startingMoves": ["a"] });
	});

	it("adds a blank background", () => {
		const { item, sheet } = editSheet({ backgrounds: [] });
		render(sheet, `<button class="playbook-background-add"></button>`);
		sheet.element.querySelector(".playbook-background-add").click();
		expect(item.update).toHaveBeenCalledWith({ "system.backgrounds": [{ slug: "background-0", label: "", description: "", moves: [], choices: null }] });
	});

	it("edits a background scalar field (label) via the whole-array write", () => {
		const { item, sheet } = editSheet({ backgrounds: [{ slug: "b0", label: "", description: "", moves: [], choices: null }] });
		render(sheet, `<input class="playbook-background-field" data-index="0" data-field="label" value="Initiate">`);
		const el = sheet.element.querySelector(".playbook-background-field");
		el.dispatchEvent(new Event("change"));
		expect(item.update).toHaveBeenCalledWith({ "system.backgrounds": [{ slug: "b0", label: "Initiate", description: "", moves: [], choices: null }] });
	});

	it("removes a background's granted move by index + slug", () => {
		const { item, sheet } = editSheet({ backgrounds: [{ slug: "b0", moves: ["a", "b"], choices: null }] });
		render(sheet, `<button class="playbook-background-move-remove" data-index="0" data-slug="a"></button>`);
		sheet.element.querySelector(".playbook-background-move-remove").click();
		expect(item.update).toHaveBeenCalledWith({ "system.backgrounds": [{ slug: "b0", moves: ["b"], choices: null }] });
	});

	it("toggles a background's choices group on and off", () => {
		const { item, sheet } = editSheet({ slug: "pb", backgrounds: [{ slug: "b0", moves: [], choices: null }] });
		render(sheet, `<button class="playbook-background-toggle-choices" data-index="0"></button>`);
		sheet.element.querySelector(".playbook-background-toggle-choices").click();
		expect(item.update).toHaveBeenCalledWith({ "system.backgrounds": [{ slug: "b0", moves: [], choices: { slug: "b0", list: [] } }] });
	});

	it("sets origin names by splitting the textarea on newlines", () => {
		const { item, sheet } = editSheet({ origin: [{ region: "Stonetop", names: [] }] });
		render(sheet, `<textarea class="playbook-origin-names" data-index="0">Arwel\nBlodwen\n</textarea>`);
		const el = sheet.element.querySelector(".playbook-origin-names");
		el.dispatchEvent(new Event("change"));
		expect(item.update).toHaveBeenCalledWith({ "system.origin": [{ region: "Stonetop", names: ["Arwel", "Blodwen"] }] });
	});

	it("adds instinct strings through the choice-group round trip", () => {
		const { item, sheet } = editSheet({ instinct: null });
		render(sheet, `<button class="playbook-instinct-add"></button>`);
		sheet.element.querySelector(".playbook-instinct-add").click();
		// One blank string → a fresh instinct group with a single empty option.
		expect(item.update).toHaveBeenCalledTimes(1);
		const patch = item.update.mock.calls[0][0];
		expect(patch["system.instinct"].list[0].options).toHaveLength(1);
	});

	it("enables special possessions, then removes a possession from slugs and preselected", () => {
		const { item, sheet } = editSheet({ specialPossessions: { slugs: ["a"], pickCount: 1, pickNote: "", preselected: ["a"] } });
		render(sheet, `<button class="playbook-possessions-remove" data-slug="a"></button>`);
		sheet.element.querySelector(".playbook-possessions-remove").click();
		expect(item.update).toHaveBeenCalledWith({ "system.specialPossessions": { slugs: [], pickCount: 1, pickNote: "", preselected: [] } });
	});

	it("toggles the appearance choice group on via the generic group toggle", () => {
		const { item, sheet } = editSheet({ slug: "pb", appearance: null });
		render(sheet, `<button class="playbook-group-toggle" data-path="system.appearance" data-slug="appearance"></button>`);
		sheet.element.querySelector(".playbook-group-toggle").click();
		expect(item.update).toHaveBeenCalledWith({ "system.appearance": { slug: "appearance", list: [] } });
	});

	it("wires nothing when the sheet is not editable", () => {
		const item  = makeItem({ moves: ["a"], startingMoves: [] });
		const sheet = makeSheet(item, { editable: false });
		sheet.element.innerHTML = `<button class="playbook-move-remove" data-slug="a"></button>`;
		sheet._onRender({}, {});
		sheet.element.querySelector(".playbook-move-remove").click();
		expect(item.update).not.toHaveBeenCalled();
	});
});
