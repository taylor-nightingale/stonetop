import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterRolling } from "../../../src/actors/character/CharacterRolling.js";
import { CharacterStats } from "../../../src/actors/character/CharacterStats.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";

// -- Helpers -------------------------------------------------------------------

function makeDebilityActor({ weakened = false, dazed = false, miserable = false, rollMode = "def" } = {}) {
	return new FakeActorBuilder()
		.withDebility("weakened", weakened)
		.withDebility("dazed", dazed)
		.withDebility("miserable", miserable)
		.withRollMode(rollMode)
		.build();
}

class FakeItemBuilder {
	constructor(id) { this._id = id; }
	withType(type)                       { this._type = type; return this; }
	withRollable(rollType, rollFormula)   { this._rollType = rollType; this._rollFormula = rollFormula; return this; }
	build() {
		return {
			_id: this._id,
			type: this._type,
			system: { rollType: this._rollType, _rollFormula: this._rollFormula },
			roll: vi.fn(),
		};
	}
}

function makeRollableItem({ id = "item-1", rollType = "str", type = "move", rollFormula = null } = {}) {
	return new FakeItemBuilder(id).withType(type).withRollable(rollType, rollFormula).build();
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

function makeRolling(actor, statsOverride = {}) {
	const stats = new CharacterStats({ system: { stats: statsOverride } });
	return new CharacterRolling(actor, stats);
}

// -- rollMode ------------------------------------------------------------------

describe("CharacterRolling.rollMode", () => {
	it("returns stored flag value", () => {
		const actor = makeDebilityActor({ rollMode: "adv" });
		expect(new CharacterRolling(actor, null).rollMode).toBe("adv");
	});

	it("defaults to 'normal' when flag not set", () => {
		const actor = new FakeActorBuilder().build();
		expect(new CharacterRolling(actor, null).rollMode).toBe("normal");
	});

	it("setRollMode writes flag and updates rollMode", async () => {
		const actor = makeDebilityActor();
		const rolling = new CharacterRolling(actor, null);
		await rolling.setRollMode("adv");
		expect(rolling.rollMode).toBe("adv");
	});
});

// -- buildDebilitiesSnapshot ---------------------------------------------------

describe("CharacterRolling.buildDebilitiesSnapshot", () => {
	it("returns exactly 3 debilities", () => {
		expect(makeRolling(makeDebilityActor()).buildDebilitiesSnapshot()).toHaveLength(3);
	});

	it("marks a debility as active when its value is true on the actor", () => {
		const snap = makeRolling(makeDebilityActor({ weakened: true })).buildDebilitiesSnapshot();
		expect(snap.find(d => d.key === "weakened").active).toBe(true);
		expect(snap.find(d => d.key === "dazed").active).toBe(false);
	});

	it("includes the correct stats array for each debility", () => {
		const snap = makeRolling(makeDebilityActor()).buildDebilitiesSnapshot();
		expect(snap.find(d => d.key === "weakened").stats).toEqual(["str", "dex"]);
		expect(snap.find(d => d.key === "dazed").stats).toEqual(["int", "wis"]);
		expect(snap.find(d => d.key === "miserable").stats).toEqual(["con", "cha"]);
	});
});

// -- applyDebilityRollMode -----------------------------------------------------

describe("CharacterRolling.applyDebilityRollMode", () => {
	it("no debility active — passes rollMode through unchanged", () => {
		const rolling = makeRolling(makeDebilityActor());
		expect(rolling.applyDebilityRollMode("str", { rollMode: "def" })).toEqual({ rollMode: "def" });
		expect(rolling.applyDebilityRollMode("str", { rollMode: "adv" })).toEqual({ rollMode: "adv" });
	});

	it("debility active, stat affected, rollMode def → dis", () => {
		const rolling = makeRolling(makeDebilityActor({ weakened: true }));
		expect(rolling.applyDebilityRollMode("str", { rollMode: "def" })).toEqual({ rollMode: "dis" });
	});

	it("debility active, stat affected, rollMode adv → def (cancel)", () => {
		const rolling = makeRolling(makeDebilityActor({ weakened: true }));
		expect(rolling.applyDebilityRollMode("str", { rollMode: "adv" })).toEqual({ rollMode: "def" });
	});

	it("debility active, stat affected, rollMode dis → dis (unchanged)", () => {
		const rolling = makeRolling(makeDebilityActor({ weakened: true }));
		expect(rolling.applyDebilityRollMode("str", { rollMode: "dis" })).toEqual({ rollMode: "dis" });
	});

	it("debility active but for a different stat — passes through unchanged", () => {
		const rolling = makeRolling(makeDebilityActor({ weakened: true }));
		expect(rolling.applyDebilityRollMode("int", { rollMode: "def" })).toEqual({ rollMode: "def" });
	});

	it("dazed covers int and wis, rollMode def → dis", () => {
		const rolling = makeRolling(makeDebilityActor({ dazed: true }));
		expect(rolling.applyDebilityRollMode("int", { rollMode: "def" })).toEqual({ rollMode: "dis" });
		expect(rolling.applyDebilityRollMode("wis", { rollMode: "def" })).toEqual({ rollMode: "dis" });
	});

	it("preserves other options fields while changing rollMode", () => {
		const rolling = makeRolling(makeDebilityActor({ weakened: true }));
		expect(rolling.applyDebilityRollMode("str", { rollMode: "adv", extra: "value" }))
			.toEqual({ rollMode: "def", extra: "value" });
	});
});

// -- onRoll --------------------------------------------------------------------

describe("CharacterRolling.onRoll", () => {
	beforeEach(() => { game.settings = { get: vi.fn(() => false) }; });
	afterEach(() => { delete game.settings; });

	function makeOnRollActor(item, { pbtaRollMode = "def", debilities = {} } = {}) {
		return new FakeActorBuilder()
			.withDebility("weakened", debilities.weakened ?? false)
			.withDebility("dazed", debilities.dazed ?? false)
			.withDebility("miserable", debilities.miserable ?? false)
			.withRollMode(pbtaRollMode)
			.withItems(item ? [item] : [])
			.build();
	}

	it("returns false when event has no item element", async () => {
		const rolling = makeRolling(makeOnRollActor(null));
		expect(await rolling.onRoll(makeItemEvent({ hasItemEl: false }))).toBe(false);
	});

	it("returns false when item has no rollType", async () => {
		const item = makeRollableItem({ rollType: null });
		const rolling = makeRolling(makeOnRollActor(item));
		expect(await rolling.onRoll(makeItemEvent())).toBe(false);
		expect(item.roll).not.toHaveBeenCalled();
	});

	it("returns true and calls item.roll when item has a rollType", async () => {
		const item = makeRollableItem({ rollType: "str" });
		const rolling = makeRolling(makeOnRollActor(item));
		expect(await rolling.onRoll(makeItemEvent())).toBe(true);
		expect(item.roll).toHaveBeenCalledOnce();
	});

	it("passes rollMode from actor stonetop flag", async () => {
		const item = makeRollableItem({ rollType: "str" });
		const rolling = makeRolling(makeOnRollActor(item, { pbtaRollMode: "adv" }));
		expect(await rolling.onRoll(makeItemEvent())).toBe(true);
		expect(item.roll).toHaveBeenCalledWith(expect.objectContaining({ rollMode: "adv" }));
	});

	it("sets descriptionOnly when data-show=description", async () => {
		const item = makeRollableItem({ rollType: "str" });
		const rolling = makeRolling(makeOnRollActor(item));
		expect(await rolling.onRoll(makeItemEvent({ showDescription: true }))).toBe(true);
		expect(item.roll).toHaveBeenCalledWith(expect.objectContaining({ descriptionOnly: true }));
	});

	it("applies disadvantage when relevant debility is active", async () => {
		const item = makeRollableItem({ rollType: "str" });
		const rolling = makeRolling(makeOnRollActor(item, { debilities: { weakened: true } }));
		expect(await rolling.onRoll(makeItemEvent())).toBe(true);
		expect(item.roll).toHaveBeenCalledWith(expect.objectContaining({ rollMode: "dis" }));
	});

	it("does not apply disadvantage when debility covers a different stat", async () => {
		const item = makeRollableItem({ rollType: "wis" });
		const rolling = makeRolling(makeOnRollActor(item, { debilities: { weakened: true } }));
		expect(await rolling.onRoll(makeItemEvent())).toBe(true);
		expect(item.roll).toHaveBeenCalledWith(expect.objectContaining({ rollMode: "def" }));
	});

	it("omits rollMode from options when hideRollMode is true", async () => {
		game.settings.get.mockReturnValue(true);
		const item = makeRollableItem({ rollType: "str" });
		const rolling = makeRolling(makeOnRollActor(item, { pbtaRollMode: "adv" }));
		expect(await rolling.onRoll(makeItemEvent())).toBe(true);
		expect(item.roll).toHaveBeenCalledWith({ descriptionOnly: false });
	});
});
