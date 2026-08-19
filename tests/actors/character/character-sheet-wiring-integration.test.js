// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { stonetopActorSheetBase } from "../../fakes/foundry/stonetopActorSheetBase.js";
import { NewInventoryItem } from "../../../src/actors/character/AddInventoryItemDialog.js";
import { fire, settle } from "../../fakes/domEvents.js";
import { warn } from "../../../src/utils/logger.js";

vi.mock("../../../src/utils/logger.js", () => ({ warn: vi.fn(), log: vi.fn(), error: vi.fn() }));

// End-to-end for the character sheet's control wiring, against a REAL StonetopCharacter.
//
// The sheet's other tests drive a spy character, which proves the sheet calls SOMETHING but not that
// the call lands. These walk each control down to actor state — the checks that were on the manual
// QA list after the actions/handlers were split into their own modules.
//
// Nothing renders .hbs here (Foundry compiles the templates), so the markup mirrors what the
// partials stamp.

function arcanumItem(slug, { flipped = false } = {}) {
	return {
		_id: `${slug}-item`, type: "arcanum", name: "Azure Hand",
		system: {
			slug, major: true, flipped,
			front: { description: "front", item: null, unlock: null },
			back:  { title: "Mysteries", description: "back", choices: [] },
			choiceValues: {},
		},
	};
}

function insertItem(slug, name) {
	return { _id: `${slug}-item`, type: "insert", name, system: { slug } };
}

function makeSheet({ items = [] } = {}) {
	new FakeGameBuilder().build();
	const actor = new FakeCharacterActorBuilder()
		.withItems(items)
		.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory()))
		.build();
	const sheet = new (createStonetopCharacterSheetClass(stonetopActorSheetBase()))(actor);
	return { sheet, actor, character: actor.typedActor };
}

// Move resources live in their own system section (StonetopCharacter wires CharacterMoves with
// `new ResourceController(actor, "moveResources")`); everything else shares `resources`.
const counts = (actor, namespace, section = "resources") =>
	actor.system?.[section]?.counts?.[namespace] ?? {};

// Invoke a data-action the way core's actions pipeline does.
async function fireAction(sheet, name, html, ev = { type: "click", button: 0 }) {
	sheet.element.innerHTML = html;
    const def = sheet.constructor.DEFAULT_OPTIONS.actions[name];
	const handler = typeof def === "function" ? def : def.handler;
	await handler.call(sheet, { preventDefault() {}, ...ev }, sheet.element.firstElementChild);
	await settle();
}

beforeEach(() => { document.body.innerHTML = ""; warn.mockClear(); });

describe("character sheet wiring — resource pips (integration)", () => {
	// A pip carries its index and its CURRENT state; clicking an unchecked pip fills through it.
	// All six kinds share that shape and differ only in which namespace they land in.
	const cases = [
		["arcanumResourcePip",    "inventory",   "resources",     `<button data-slug="azure-hand" data-index="1"></button>`, "azure-hand"],
		["backgroundResourcePip", "backgrounds", "resources",     `<button data-slug="exile" data-index="2"></button>`,      "exile"],
		["followerLoyaltyPip",    "followers",   "resources",     `<button data-slug="enfys" data-index="0"></button>`,      "enfys"],
		["moveResourcePip",       "moves",       "moveResources", `<button data-move-slug="trade" data-index="2"></button>`, "trade"],
	];

	for (const [action, namespace, section, markup, slug] of cases) {
		const index = Number(markup.match(/data-index="(\d+)"/)[1]);

		it(`${action} fills its track through the clicked pip`, async () => {
			const { sheet, actor } = makeSheet();

			await fireAction(sheet, action, markup);

			expect(counts(actor, namespace, section)[slug]).toBe(index + 1);
		});

		it(`${action} clears back to the clicked pip when it was already checked`, async () => {
			const { sheet, actor } = makeSheet();

			await fireAction(sheet, action, markup.replace("<button", `<button class="is-checked"`));

			expect(counts(actor, namespace, section)[slug]).toBe(index);
		});
	}

	it("inventoryResourcePip routes to the character's own inventory by default", async () => {
		const { sheet, actor } = makeSheet();

		await fireAction(sheet, "inventoryResourcePip", `<button data-slug="rations" data-index="1"></button>`);

		expect(counts(actor, "inventory").rations).toBe(2);
	});

	// The same partial renders inside a follower card; the wrapper is what re-routes it.
	it("inventoryResourcePip routes to the follower whose catalog it sits in", async () => {
		const { sheet, actor } = makeSheet();
		sheet.element.innerHTML = `
			<div class="stonetop-follower-inventory" data-slug="enfys">
				<button data-slug="rations" data-index="1"></button>
			</div>`;
		const def = sheet.constructor.DEFAULT_OPTIONS.actions.inventoryResourcePip;
		await def.call(sheet, { type: "click", button: 0, preventDefault() {} },
			sheet.element.querySelector("button"));
		await settle();

		// The character's own inventory is untouched; the follower's item took the write.
		expect(counts(actor, "inventory").rations).toBeUndefined();
	});
});

describe("character sheet wiring — arcana (integration)", () => {
	it("flipArcanum flips the owned arcanum on the actor", async () => {
		const { sheet, actor } = makeSheet({ items: [arcanumItem("azure-hand", { flipped: false })] });

		await fireAction(sheet, "flipArcanum",
			`<div class="stonetop-arcanum-card" data-slug="azure-hand" data-flipped="false"></div>`);

		expect([...actor.items].find(i => i.type === "arcanum").system.flipped).toBe(true);
	});

	it("flipArcanum unflips one that was already flipped", async () => {
		const { sheet, actor } = makeSheet({ items: [arcanumItem("azure-hand", { flipped: true })] });

		await fireAction(sheet, "flipArcanum",
			`<div class="stonetop-arcanum-card" data-slug="azure-hand" data-flipped="true"></div>`);

		expect([...actor.items].find(i => i.type === "arcanum").system.flipped).toBe(false);
	});

	// The card is pinned across every render the flip's writes cause, so it does not jump.
	it("runs the flip inside its card's scroll anchor", async () => {
		const { sheet } = makeSheet({ items: [arcanumItem("azure-hand")] });
		const hold = vi.spyOn(sheet._scrollAnchoring, "hold");

		await fireAction(sheet, "flipArcanum",
			`<div class="stonetop-arcanum-card" data-slug="azure-hand" data-flipped="false"></div>`);

		const [, anchorSelector, containerSelector] = hold.mock.calls[0];
		expect(anchorSelector).toBe(`.stonetop-arcanum-card[data-slug="azure-hand"]`);
		expect(containerSelector).toBe(".sheet-body");
	});
});

describe("character sheet wiring — inventory and followers (integration)", () => {
	it("adds a custom inventory item through the dialog down to the actor", async () => {
		const { sheet, character } = makeSheet();
		sheet._addInventoryItemDialog = { show: vi.fn(async () => NewInventoryItem.regular("Rope", 2)) };
		const added = vi.spyOn(character, "addCustomInventoryItemFor");

		await fireAction(sheet, "addInventoryItem", `<button data-column="regular"></button>`);

		expect(sheet._addInventoryItemDialog.show).toHaveBeenCalledWith({ isRegular: true });
		const [owner, item] = added.mock.calls[0];
		expect(owner.isFollower).toBe(false);
		expect(item).toEqual(NewInventoryItem.regular("Rope", 2));
	});

	it("adds nothing when the dialog is dismissed", async () => {
		const { sheet, character } = makeSheet();
		sheet._addInventoryItemDialog = { show: vi.fn(async () => null) };
		const added = vi.spyOn(character, "addCustomInventoryItemFor");

		await fireAction(sheet, "addInventoryItem", `<button data-column="small"></button>`);

		expect(added).not.toHaveBeenCalled();
	});

	// Server-side expand/collapse: only the open follower's (large) catalog is built, and the open
	// state has to survive the re-render the toggle itself causes.
	it("toggles a follower inventory open and shut across renders", async () => {
		const { sheet } = makeSheet();

		await fireAction(sheet, "toggleFollowerInventory", `<button data-slug="enfys"></button>`);
		expect(sheet._openFollowerInventories.has("enfys")).toBe(true);
		await sheet._prepareContext({}); // the render the toggle triggered
		expect(sheet._openFollowerInventories.has("enfys")).toBe(true);

		await fireAction(sheet, "toggleFollowerInventory", `<button data-slug="enfys"></button>`);
		expect(sheet._openFollowerInventories.has("enfys")).toBe(false);
	});
});

describe("character sheet wiring — tabs and the router (integration)", () => {
	it("renders the six fixed tabs plus one per owned insert", async () => {
		const { sheet } = makeSheet({ items: [insertItem("the-crew", "The Crew")] });

		const ctx = await sheet._prepareContext({});

		expect(Object.keys(ctx.tabs)).toEqual([
			"playbook", "moves", "inventory", "arcana", "followers", "notes", "insert-the-crew",
		]);
		expect(ctx.tabs["insert-the-crew"].label).toBe("The Crew");
	});

	it("carries the moves filter into the context so it survives a re-render", async () => {
		const { sheet } = makeSheet();

		expect((await sheet._prepareContext({})).hideUnselectedMoves).toBe(false);
		sheet._setHideUnselectedMoves(true, null);
		expect((await sheet._prepareContext({})).hideUnselectedMoves).toBe(true);
	});

	// A stamped name with no handler behind it is silent in play except for this warning.
	it("routes every stamped change control without reporting template drift", async () => {
		const { sheet } = makeSheet();
		await sheet._onFirstRender({}, {});

		sheet.element.innerHTML = `
			<input data-change-action="hp" value="5">
			<input data-change-action="maxHp" value="9">
			<input data-change-action="xp" value="2">
			<input data-change-action="level" value="3">
			<input data-change-action="armor" value="1">
			<input data-change-action="rollMode" value="adv">
			<input type="checkbox" data-change-action="debility" data-slug="weak">
			<input data-change-action="bio" value="a life">
			<input data-change-action="charNotes" value="a note">
			<input data-change-action="outfitLoad" value="light">
			<input data-change-action="inventoryOtherItems" value="odds">
			<input type="checkbox" data-change-action="possessionCheck" data-slug="map">
			<input data-change-action="moveResourceText" data-move-slug="trade" value="grain">
			<input data-change-action="followerName" data-slug="enfys" value="Enfys">`;
		for (const el of sheet.element.querySelectorAll("[data-change-action]")) fire(el, "change");
		await settle();

		expect(warn).not.toHaveBeenCalled();
	});

	it("stays silent on the choice-group rows it does not own", async () => {
		const { sheet } = makeSheet();
		await sheet._onFirstRender({}, {});

		sheet.element.innerHTML = `<input type="checkbox" data-change-action="cgTrack"
			data-cg-context="instinct" data-cg-group="g" data-cg-option="o" data-cg-index="0">`;
		fire(sheet.element.querySelector("input"), "change");
		await settle();

		expect(warn).not.toHaveBeenCalled();
	});
});
