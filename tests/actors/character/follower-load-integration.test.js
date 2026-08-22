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
// top out at "heavy" and never report the difference between a full pack and an absurd one. The
// limit is the same 9 ◇ Outfit gives a character, and it is not editable. End to end, through the
// real sheet wiring and the real templates.

const item = (slug, weight) => new OutfitItemBuilder()
	.withSlug(slug).withName(slug).withWeight(weight).withInventoryColumn("regular").build();

const followerItem = () => ({
	_id: "crew-item",
	type: "follower",
	name: "Crew",
	system: { slug: "crew", owned: true, showOnTab: true, inventory: { checked: {} } },
});

function makeSheet() {
	new FakeGameBuilder().build();
	const inventory = new FakeInventoryRepository([item("pack", 3), item("shield", 2), item("anvil", 6)]);
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
const carried = sheet => capacityBox(sheet).textContent.replace(/\s+/g, " ").trim();
const isOver = sheet => capacityBox(sheet).classList.contains("is-over");

async function check(sheet, slug) {
	const box = sheet.element.querySelector(
		`.stonetop-follower-inventory .stonetop-inventory-item-check[data-slug="${slug}"]`);
	box.checked = true;
	fire(box, "change");
	await settle();
}

beforeEach(() => { document.body.innerHTML = ""; });

describe("follower load (integration)", () => {
	it("shows the ◇ the follower is carrying, with nothing to edit", async () => {
		const { sheet } = makeSheet();
		await render(sheet);
		await open(sheet);
		expect(carried(sheet)).toBe("0 ◇");
		expect(isOver(sheet)).toBe(false);
	});

	it("counts up as gear is taken, and never offers a limit to type into", async () => {
		const { sheet } = makeSheet();
		await render(sheet);
		await open(sheet);

		await check(sheet, "pack");
		await render(sheet);
		expect(carried(sheet)).toBe("3 ◇");
		expect(capacityBox(sheet).querySelector("input")).toBeNull();
	});

	it("flags the follower once the gear passes the 9 ◇ Outfit allows, and still holds it", async () => {
		const { sheet, actor } = makeSheet();
		await render(sheet);
		await open(sheet);

		await check(sheet, "pack");                       // 3
		await check(sheet, "shield");                     // 5
		await render(sheet);
		expect(isOver(sheet)).toBe(false);

		await check(sheet, "anvil");                      // 11
		await render(sheet);
		expect(isOver(sheet)).toBe(true);
		expect(carried(sheet)).toContain("11 ◇");
		// Guidance, not a cap: every item is still checked.
		const inv = [...actor.items].find(i => i._id === "crew-item").system.inventory;
		expect(inv.checked).toMatchObject({ pack: true, shield: true, anvil: true });
	});
});
