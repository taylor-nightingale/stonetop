import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {CharacterStats} from "../../../module/actors/character/CharacterStats.js";
import {Stats} from "../../../module/model/data/character/Stats.js";
import {FakeActorBuilder} from "../../fakes/FakeActorBuilder.js";

// -- Helpers -------------------------------------------------------------------

function makeStatsActor(stats = {}) {
	return {system: {stats}};
}

function makeDebilityActor({weakened = false, dazed = false, miserable = false} = {}) {
	return new FakeActorBuilder()
		.withDebility("weakened", weakened)
		.withDebility("dazed", dazed)
		.withDebility("miserable", miserable)
		.build();
}

class FakeItemBuilder {
	_id;
	_type;
	_rollType;
	_rollFormula;

	constructor(id) {
		this._id = id;
	}

	withType(type) {
		this._type = type;
		return this;
	}

	withRollable(rollType, rollFormula) {
		this._rollType = rollType;
		this._rollFormula = rollFormula;
		return this;
	}

	build() {
		return {
			_id: this._id,
			type: this._type,
			system: {rollType: this._rollType, _rollFormula: this._rollFormula},
			roll: vi.fn(),
		};
	}
}

function makeRollableItem({id = "item-1", rollType = "str", type = "move", rollFormula = null} = {}) {
	return new FakeItemBuilder(id)
		.withType(type)
		.withRollable(rollType, rollFormula)
		.build();
}

function makeItemEvent({itemId = "item-1", showDescription = false, hasItemEl = true} = {}) {
	return {
		currentTarget: {
			closest: (sel) => sel === ".item" && hasItemEl ? {dataset: {itemId}} : null,
			getAttribute: (attr) => attr === "data-show" && showDescription ? "description" : null,
			classList: {contains: () => false},
			dataset: {},
		},
	};
}

function makeOnRollActor(item, {pbtaRollMode = "def", debilities = {}} = {}) {
	const actor = new FakeActorBuilder()
		.withDebility("weakened", debilities.weakened ?? false)
		.withDebility("dazed", debilities.dazed ?? false)
		.withDebility("miserable", debilities.miserable ?? false)
		.withRollMode(pbtaRollMode)
		.withItems(item ? [item] : [])
		.build();
	return actor;
}

// -- getStats ------------------------------------------------------------------

describe("CharacterStats.getStats", () => {
	it("returns a Stats instance", () => {
		expect(new CharacterStats(makeStatsActor()).getStats()).toBeInstanceOf(Stats);
	});

	it("named stat property reflects actor value", () => {
		const actor = makeStatsActor({con: {value: 3}});
		expect(new CharacterStats(actor).getStats().con).toBe(3);
	});

	it("get(key) reflects actor value", () => {
		const actor = makeStatsActor({str: {value: -1}});
		expect(new CharacterStats(actor).getStats().get("str")).toBe(-1);
	});

	it("defaults to 0 for missing stats", () => {
		expect(new CharacterStats(makeStatsActor()).getStats().wis).toBe(0);
	});
});

// -- buildStatsSnapshot --------------------------------------------------------

describe("CharacterStats.buildStatsSnapshot", () => {
	it("returns an entry for each of the 6 stats", () => {
		const stats = new CharacterStats(makeStatsActor());
		const snap = stats.buildStatsSnapshot();
		expect(Object.keys(snap)).toEqual(["str", "dex", "con", "int", "wis", "cha"]);
	});

	it("maps the value from actor system.stats", () => {
		const actor = makeStatsActor({str: {value: 3}, dex: {value: -1}});
		const stats = new CharacterStats(actor);
		const snap = stats.buildStatsSnapshot();
		expect(snap.str.value).toBe(3);
		expect(snap.dex.value).toBe(-1);
	});

	it("defaults to 0 when a stat is missing from the actor", () => {
		const stats = new CharacterStats(makeStatsActor());
		expect(stats.buildStatsSnapshot().wis.value).toBe(0);
	});
});

// -- buildDebilitiesSnapshot ---------------------------------------------------

describe("CharacterStats.buildDebilitiesSnapshot", () => {
	it("returns exactly 3 debilities", () => {
		const stats = new CharacterStats(makeDebilityActor());
		expect(stats.buildDebilitiesSnapshot()).toHaveLength(3);
	});

	it("marks a debility as active when its value is true on the actor", () => {
		const stats = new CharacterStats(makeDebilityActor({weakened: true}));
		const snap = stats.buildDebilitiesSnapshot();
		expect(snap.find(d => d.key === "weakened").active).toBe(true);
		expect(snap.find(d => d.key === "dazed").active).toBe(false);
	});

	it("includes the correct stats array for each debility", () => {
		const stats = new CharacterStats(makeDebilityActor());
		const snap = stats.buildDebilitiesSnapshot();
		expect(snap.find(d => d.key === "weakened").stats).toEqual(["str", "dex"]);
		expect(snap.find(d => d.key === "dazed").stats).toEqual(["int", "wis"]);
		expect(snap.find(d => d.key === "miserable").stats).toEqual(["con", "cha"]);
	});
});

// -- applyDebilityRollMode -----------------------------------------------------

describe("CharacterStats.applyDebilityRollMode", () => {
	it("no debility active — passes rollMode def through unchanged", () => {
		const stats = new CharacterStats(makeDebilityActor());
		expect(stats.applyDebilityRollMode("str", {rollMode: "def"})).toEqual({rollMode: "def"});
	});

	it("no debility active — passes rollMode adv through unchanged", () => {
		const stats = new CharacterStats(makeDebilityActor());
		expect(stats.applyDebilityRollMode("str", {rollMode: "adv"})).toEqual({rollMode: "adv"});
	});

	it("debility active, stat affected, rollMode def → dis", () => {
		const stats = new CharacterStats(makeDebilityActor({weakened: true}));
		expect(stats.applyDebilityRollMode("str", {rollMode: "def"})).toEqual({rollMode: "dis"});
	});

	it("debility active, stat affected, rollMode adv → def (cancel)", () => {
		const stats = new CharacterStats(makeDebilityActor({weakened: true}));
		expect(stats.applyDebilityRollMode("str", {rollMode: "adv"})).toEqual({rollMode: "def"});
	});

	it("debility active, stat affected, rollMode dis → dis (unchanged)", () => {
		const stats = new CharacterStats(makeDebilityActor({weakened: true}));
		expect(stats.applyDebilityRollMode("str", {rollMode: "dis"})).toEqual({rollMode: "dis"});
	});

	it("debility active but for a different stat — passes through unchanged", () => {
		const stats = new CharacterStats(makeDebilityActor({weakened: true}));
		expect(stats.applyDebilityRollMode("int", {rollMode: "def"})).toEqual({rollMode: "def"});
	});

	it("debility value false (unchecked) — passes through unchanged", () => {
		const stats = new CharacterStats(makeDebilityActor({weakened: false}));
		expect(stats.applyDebilityRollMode("str", {rollMode: "def"})).toEqual({rollMode: "def"});
	});

	it("two debilities active, one covers stat, rollMode adv → def", () => {
		const stats = new CharacterStats(makeDebilityActor({weakened: true, dazed: true}));
		expect(stats.applyDebilityRollMode("str", {rollMode: "adv"})).toEqual({rollMode: "def"});
	});

	it("dazed covers int and wis, rollMode def → dis for int", () => {
		const stats = new CharacterStats(makeDebilityActor({dazed: true}));
		expect(stats.applyDebilityRollMode("int", {rollMode: "def"})).toEqual({rollMode: "dis"});
		expect(stats.applyDebilityRollMode("wis", {rollMode: "def"})).toEqual({rollMode: "dis"});
	});

	it("preserves other options fields while changing rollMode", () => {
		const stats = new CharacterStats(makeDebilityActor({weakened: true}));
		const result = stats.applyDebilityRollMode("str", {rollMode: "adv", extra: "value"});
		expect(result).toEqual({rollMode: "def", extra: "value"});
	});
});

// -- onRoll --------------------------------------------------------------------

describe("CharacterStats.onRoll", () => {
	beforeEach(() => {
		game.settings = {get: vi.fn(() => false)};
	});
	afterEach(() => {
		delete game.settings;
	});

	it("returns false when event has no item element", async () => {
		const stats = new CharacterStats(makeOnRollActor(null));
		expect(await stats.onRoll(makeItemEvent({hasItemEl: false}))).toBe(false);
	});

	it("returns false when item has no rollType", async () => {
		const item = makeRollableItem({rollType: null});
		const stats = new CharacterStats(makeOnRollActor(item));
		expect(await stats.onRoll(makeItemEvent())).toBe(false);
		expect(item.roll).not.toHaveBeenCalled();
	});

	it("returns true and calls item.roll when item has a rollType", async () => {
		const item = makeRollableItem({rollType: "str"});
		const stats = new CharacterStats(makeOnRollActor(item));
		expect(await stats.onRoll(makeItemEvent())).toBe(true);
		expect(item.roll).toHaveBeenCalledOnce();
	});

	it("passes rollMode from actor pbta flag", async () => {
		const item = makeRollableItem({rollType: "str"});
		const stats = new CharacterStats(makeOnRollActor(item, {pbtaRollMode: "adv"}));
		expect(await stats.onRoll(makeItemEvent())).toBe(true);
		expect(item.roll).toHaveBeenCalledWith(expect.objectContaining({rollMode: "adv"}));
	});

	it("sets descriptionOnly when data-show=description", async () => {
		const item = makeRollableItem({rollType: "str"});
		const stats = new CharacterStats(makeOnRollActor(item));
		expect(await stats.onRoll(makeItemEvent({showDescription: true}))).toBe(true);
		expect(item.roll).toHaveBeenCalledWith(expect.objectContaining({descriptionOnly: true}));
	});

	it("sets descriptionOnly for npcMove with no rollFormula", async () => {
		const item = makeRollableItem({rollType: "str", type: "npcMove", rollFormula: null});
		const stats = new CharacterStats(makeOnRollActor(item));
		expect(await stats.onRoll(makeItemEvent())).toBe(true);
		expect(item.roll).toHaveBeenCalledWith(expect.objectContaining({descriptionOnly: true}));
	});

	it("applies disadvantage when relevant debility is active", async () => {
		const item = makeRollableItem({rollType: "str"});
		const stats = new CharacterStats(makeOnRollActor(item, {debilities: {weakened: true}}));
		expect(await stats.onRoll(makeItemEvent())).toBe(true);
		expect(item.roll).toHaveBeenCalledWith(expect.objectContaining({rollMode: "dis"}));
	});

	it("does not apply disadvantage when debility covers a different stat", async () => {
		const item = makeRollableItem({rollType: "wis"});
		const stats = new CharacterStats(makeOnRollActor(item, {debilities: {weakened: true}}));
		expect(await stats.onRoll(makeItemEvent())).toBe(true);
		expect(item.roll).toHaveBeenCalledWith(expect.objectContaining({rollMode: "def"}));
	});

	it("omits rollMode from options when hideRollMode is true", async () => {
		game.settings.get.mockReturnValue(true);
		const item = makeRollableItem({rollType: "str"});
		const stats = new CharacterStats(makeOnRollActor(item, {pbtaRollMode: "adv"}));
		expect(await stats.onRoll(makeItemEvent())).toBe(true);
		expect(item.roll).toHaveBeenCalledWith({descriptionOnly: false});
	});
});
