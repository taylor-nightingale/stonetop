// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeInventoryRepository } from "../../fakes/FakeInventoryRepository.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { OutfitItemBuilder } from "../../../src/model/data/character/OutfitItem.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";
import { fire, settle } from "../../fakes/domEvents.js";

// A follower carrying more than they can manage has to SAY so on the sheet — the load bands alone
// top out at "heavy" and never report the difference between a full pack and an absurd one. End to
// end, through the real sheet wiring and the real templates.

const item = (slug, weight) => new OutfitItemBuilder()
	.withSlug(slug).withName(slug).withWeight(weight).withInventoryColumn("regular").build();

const followerItem = () => ({
	_id: "crew-item",
	type: "follower",
	name: "Crew",
	system: { slug: "crew", owned: true, showOnTab: true, loadCapacity: 4, inventory: { checked: {} } },
});

function makeSheet() {
	new FakeGameBuilder().build();
	const inventory = new FakeInventoryRepository([item("pack", 3), item("shield", 2)]);
	const actor = new FakeCharacterActorBuilder()
		.withItems([followerItem()])
		.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory({ inventory })))
		.build();
	const Base = class {
		tabGroups = {};
		element = document.createElement("form");
		_editable = true;
		render = vi.fn();
		get actor() { return actor; }
		get typedActor() { return actor.typedActor; }
		get isEditable() { return this._editable; }
		_getTabsConfig(group) { return this.constructor.TABS[group] ?? null; }
		async _prepareContext() {
			return { tabs: {}, actor, editable: true, stonetop: await actor.typedActor.buildSnapshot() };
		}
		async _onFirstRender() {}
		_onRender() {}
	};
	return { sheet: new (createStonetopCharacterSheetClass(Base))(), actor };
}

async function render(sheet) {
	const context = await sheet._prepareContext({});
	sheet.element.innerHTML = renderTemplate("systems/stonetop/templates/actor/character.hbs", context);
	await sheet._onFirstRender(context, {});
	return context;
}

// The inventory renders its catalog (and the load head) only while the follower is expanded, which
// is a server-side toggle — so every test opens it first, the way a click does.
async function open(sheet) {
	const toggle = sheet.element.querySelector('.stonetop-follower-inv-toggle[data-slug="crew"]');
	sheet.constructor.DEFAULT_OPTIONS.actions.toggleFollowerInventory
		.call(sheet, { type: "click", button: 0, preventDefault: vi.fn() }, toggle);
	await settle();
	await render(sheet);
}

const capacityBox = sheet => sheet.element.querySelector(".stonetop-follower-capacity");
const capacityInput = sheet => sheet.element.querySelector(".stonetop-follower-capacity-input");
const isOver = sheet => capacityBox(sheet).classList.contains("is-over");

async function check(sheet, slug) {
	const box = sheet.element.querySelector(
		`.stonetop-follower-inventory .stonetop-inventory-item-check[data-slug="${slug}"]`);
	box.checked = true;
	fire(box, "change");
	await settle();
}

beforeEach(() => { document.body.innerHTML = ""; });

describe("follower load capacity (integration)", () => {
	it("shows what the follower carries against their capacity", async () => {
		const { sheet } = makeSheet();
		await render(sheet);
		await open(sheet);
		expect(capacityBox(sheet).textContent.replace(/\s+/g, " ").trim()).toContain("0 /");
		expect(capacityInput(sheet).value).toBe("4");
		expect(isOver(sheet)).toBe(false);
	});

	it("flags the follower once the gear passes their capacity, and still holds it", async () => {
		const { sheet, actor } = makeSheet();
		await render(sheet);
		await open(sheet);

		await check(sheet, "pack");                       // 3 of 4
		await render(sheet);
		expect(isOver(sheet)).toBe(false);

		await check(sheet, "shield");                     // 5 of 4
		await render(sheet);
		expect(isOver(sheet)).toBe(true);
		expect(capacityBox(sheet).textContent.replace(/\s+/g, " ").trim()).toContain("5 /");
		// Guidance, not a cap: both items are still checked.
		const inv = [...actor.items].find(i => i._id === "crew-item").system.inventory;
		expect(inv.checked).toMatchObject({ pack: true, shield: true });
	});

	it("raising the capacity on the sheet clears the flag", async () => {
		const { sheet } = makeSheet();
		await render(sheet);
		await open(sheet);
		await check(sheet, "pack");
		await check(sheet, "shield");
		await render(sheet);
		expect(isOver(sheet)).toBe(true);

		const box = capacityInput(sheet);
		box.value = "9";
		fire(box, "change");
		await settle();

		await render(sheet);
		expect(capacityInput(sheet).value).toBe("9");
		expect(isOver(sheet)).toBe(false);
	});
});
