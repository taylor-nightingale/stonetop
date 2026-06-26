import { describe, it, expect, vi } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../module/actors/character/StonetopCharacterSheet.js";
import {FakeActorBuilder} from "../../fakes/FakeActorBuilder.js";

// -- Helpers ------------------------------------------------------------------

function makeCharacterMock(actor) {
	const background = {
		selectBackground: vi.fn(async slug => actor.setFlag("stonetop", "background.selected", slug)),
		addChoice: vi.fn(),
		selectedSlug: actor.getFlag("stonetop", "background.selected") ?? "",
		choices: {},
	};
	const instinct = { select: vi.fn(), selectedValue: "" };
	const appearance = {
		select: vi.fn(async (lineIdx, value) => {
			const saved = actor.getFlag("stonetop", "appearance.selected") ?? {};
			actor.setFlag("stonetop", "appearance.selected", { ...saved, [lineIdx]: value });
		}),
		saved: actor.getFlag("stonetop", "appearance.selected") ?? {},
	};
	const origin = { select: vi.fn() };
	return {
		background,
		instinct,
		appearance,
		origin,
		ensureStartingMoves: vi.fn(),
		updateName: vi.fn(async name => actor.update({ name })),
		addMove: vi.fn(),
		removeMove: vi.fn(),
		addArcanum: vi.fn(async () => {}),
		onDropMove: vi.fn(async () => false),
		moveResources: { add: vi.fn() },
		buildSnapshot: vi.fn(async () => ({})),
		setInventoryResource: vi.fn(),
	};
}

function recoverSnapshot({ hpValue = 4, hpMax = 8, smallItemLimit = 5 } = {}) {
	return { vitals: { hp: { value: hpValue, max: hpMax } }, inventory: { smallItemLimit } };
}

function makeActor() {
	const actor = new FakeActorBuilder().build();
	actor.typedActor = makeCharacterMock(actor);
	return actor;
}

function makeSheet(actor) {
	const Base = class {
		constructor() { this._actor = actor; }
		get actor() { return this._actor; }
		get isEditable() { return true; }
		async getData() { return {}; }
		activateListeners() {}
		render = vi.fn();
		async _onDropItemCreate() {}
	};
	const Sheet = createStonetopCharacterSheetClass(Base);
	return new Sheet();
}

// -- Event handler tests ------------------------------------------------------

// -- Item fixtures ------------------------------------------------------------

function makeArcanum(slug = "humble-broom") {
	return { type: "move", system: { moveType: "arcanum" }, flags: { stonetop: { slug } } };
}

function makeMove() {
	return { type: "move", system: { moveType: "basic" }, flags: {} };
}

function makeNonMove() {
	return { type: "equipment", system: {}, flags: {} };
}

// -- Tests --------------------------------------------------------------------

describe("StonetopCharacterSheet event handlers", () => {
	it("_onBackgroundChange calls selectBackground with the slug", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		await sheet._onBackgroundChange({ currentTarget: { value: "vessel" } });
		expect(actor.typedActor.background.selectBackground).toHaveBeenCalledWith("vessel");
	});

	it("_onBackgroundChange calls ensureStartingMoves after selecting background", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		await sheet._onBackgroundChange({ currentTarget: { value: "vessel" } });
		expect(actor.typedActor.ensureStartingMoves).toHaveBeenCalled();
	});

	it("_onAppearanceChange calls appearance.select with lineIdx and value", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		await sheet._onAppearanceChange({ currentTarget: { dataset: { line: "0" }, value: "gray & wizened" } });
		expect(actor.typedActor.appearance.select).toHaveBeenCalledWith(0, "gray & wizened");
	});

	it("_onOriginNameClick updates the actor name", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		await sheet._onOriginNameClick({ currentTarget: { value: "Arwel" } });
		expect(actor.typedActor.updateName).toHaveBeenCalledWith("Arwel");
	});
});

describe("StonetopCharacterSheet._buildRecoverData", () => {
	it("can recover when supplies remain, HP is below max, and not locked", () => {
		const actor = new FakeActorBuilder().withFlag("inventory.resources", { supplies: 3 }).build();
		actor.typedActor = makeCharacterMock(actor);
		const sheet = makeSheet(actor);
		const data = sheet._buildRecoverData(recoverSnapshot({ hpValue: 4, hpMax: 8, smallItemLimit: 5 }));
		expect(data.canRecover).toBe(true);
		expect(data.healAmount).toBe(5);
		expect(data.suppliesLeft).toBe(3);
		expect(data.hint).toBeNull();
	});

	it("sums uses across all three supply tiers", () => {
		const actor = new FakeActorBuilder()
			.withFlag("inventory.resources", { supplies: 1, "more-supplies": 2, "even-more-supplies": 4 })
			.build();
		actor.typedActor = makeCharacterMock(actor);
		const sheet = makeSheet(actor);
		const data = sheet._buildRecoverData(recoverSnapshot());
		expect(data.suppliesLeft).toBe(7);
	});

	it("locks (with hint) once recover.spent is set, until damage is taken", () => {
		const actor = new FakeActorBuilder()
			.withFlag("inventory.resources", { supplies: 3 })
			.withFlag("recover.spent", true)
			.build();
		actor.typedActor = makeCharacterMock(actor);
		const sheet = makeSheet(actor);
		const data = sheet._buildRecoverData(recoverSnapshot({ hpValue: 4 }));
		expect(data.locked).toBe(true);
		expect(data.canRecover).toBe(false);
		expect(data.hint.icon).toBe("fa-lock");
	});

	it("cannot recover with no supplies", () => {
		const actor = new FakeActorBuilder().withFlag("inventory.resources", {}).build();
		actor.typedActor = makeCharacterMock(actor);
		const sheet = makeSheet(actor);
		const data = sheet._buildRecoverData(recoverSnapshot({ hpValue: 4 }));
		expect(data.canRecover).toBe(false);
		expect(data.hint.icon).toBe("fa-triangle-exclamation");
	});

	it("cannot recover at full HP", () => {
		const actor = new FakeActorBuilder().withFlag("inventory.resources", { supplies: 3 }).build();
		actor.typedActor = makeCharacterMock(actor);
		const sheet = makeSheet(actor);
		const data = sheet._buildRecoverData(recoverSnapshot({ hpValue: 8, hpMax: 8 }));
		expect(data.canRecover).toBe(false);
		expect(data.hint.icon).toBe("fa-heart");
	});
});

describe("StonetopCharacterSheet._applyRecover", () => {
	const emptyHtml = [{ querySelector: () => ({ value: "" }) }];

	it("decrements one use of the chosen supply slug", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		await sheet._applyRecover(emptyHtml, { supplySlug: "supplies", currentUses: 3, oldHp: 4, newHp: 8 });
		expect(actor.typedActor.setInventoryResource).toHaveBeenCalledWith("supplies", 2);
	});

	it("heals to the new HP and locks the move", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		await sheet._applyRecover(emptyHtml, { supplySlug: "supplies", currentUses: 1, oldHp: 4, newHp: 9 });
		expect(actor.update).toHaveBeenCalledWith({
			"system.attributes.hp.value": 9,
			"flags.stonetop.recover.spent": true,
		});
	});

	it("re-renders after applying", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		await sheet._applyRecover(emptyHtml, { supplySlug: "supplies", currentUses: 2, oldHp: 4, newHp: 8 });
		expect(sheet.render).toHaveBeenCalledWith(false);
	});
});

describe("StonetopCharacterSheet._onDropItemCreate", () => {
	it("calls addArcanum with the slug from flags when an arcanum is dropped", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		await sheet._onDropItemCreate(makeArcanum("humble-broom"));
		expect(actor.typedActor.addArcanum).toHaveBeenCalledWith("humble-broom");
	});

	it("accepts an array of items", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		await sheet._onDropItemCreate([makeArcanum("humble-broom"), makeArcanum("stone-idol")]);
		expect(actor.typedActor.addArcanum).toHaveBeenCalledWith("humble-broom");
		expect(actor.typedActor.addArcanum).toHaveBeenCalledWith("stone-idol");
	});

	it("skips arcanum with no slug in flags", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		const noSlug = { type: "move", system: { moveType: "arcanum" }, flags: {} };
		await sheet._onDropItemCreate(noSlug);
		expect(actor.typedActor.addArcanum).not.toHaveBeenCalled();
	});

	it("routes regular moves to onDropMove", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		const move = makeMove();
		await sheet._onDropItemCreate(move);
		expect(actor.typedActor.onDropMove).toHaveBeenCalledWith(move);
		expect(actor.typedActor.addArcanum).not.toHaveBeenCalled();
	});

	it("does not route non-move items to addArcanum or onDropMove", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		await sheet._onDropItemCreate(makeNonMove());
		expect(actor.typedActor.addArcanum).not.toHaveBeenCalled();
		expect(actor.typedActor.onDropMove).not.toHaveBeenCalled();
	});

	it("calls render after dropping an arcanum", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		await sheet._onDropItemCreate(makeArcanum("humble-broom"));
		expect(sheet.render).toHaveBeenCalledWith(false);
	});

	it("does not call render when nothing was added", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		await sheet._onDropItemCreate(makeNonMove());
		expect(sheet.render).not.toHaveBeenCalled();
	});
});
