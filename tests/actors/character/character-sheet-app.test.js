import { describe, it, expect, vi } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
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
		selectOption: vi.fn(),
	};
	const origin = { select: vi.fn(), selectName: vi.fn() };
	return {
		background,
		instinct,
		appearance,
		origin,
		selectBackground: vi.fn(),
		onDropItems: vi.fn(async () => ({ anyAdded: false, others: [] })),
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
	return { type: "arcanum", system: {}, flags: {} };
}

// -- Tests --------------------------------------------------------------------

describe("StonetopCharacterSheet event handlers", () => {
	it("_onBackgroundChange calls selectBackground with the slug", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		await sheet._onBackgroundChange({ currentTarget: { value: "vessel" } });
		expect(actor.typedActor.selectBackground).toHaveBeenCalledWith("vessel");
	});

	it("_onOriginNameClick calls origin.selectName with trimmed text", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		await sheet._onOriginNameClick({ currentTarget: { textContent: "  Arwel  " } });
		expect(actor.typedActor.origin.selectName).toHaveBeenCalledWith("Arwel");
	});
});

describe("StonetopCharacterSheet._onDropItemCreate", () => {
	it("passes items array to onDropItems", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		const items = [makeArcanum("humble-broom"), makeMove()];
		await sheet._onDropItemCreate(items);
		expect(actor.typedActor.onDropItems).toHaveBeenCalledWith(items);
	});

	it("wraps a single item in an array for onDropItems", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		const item = makeArcanum("humble-broom");
		await sheet._onDropItemCreate(item);
		expect(actor.typedActor.onDropItems).toHaveBeenCalledWith([item]);
	});

	it("does not call render explicitly — Foundry re-renders after document mutation", async () => {
		const actor = makeActor();
		const sheet = makeSheet(actor);
		actor.typedActor.onDropItems.mockResolvedValue({ anyAdded: true, others: [] });
		await sheet._onDropItemCreate(makeArcanum("humble-broom"));
		expect(sheet.render).not.toHaveBeenCalled();
	});
});
