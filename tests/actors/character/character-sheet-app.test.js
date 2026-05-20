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
	};
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
		await sheet._onOriginNameClick({ currentTarget: { textContent: "  Arwel  " } });
		expect(actor.typedActor.updateName).toHaveBeenCalledWith("Arwel");
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
