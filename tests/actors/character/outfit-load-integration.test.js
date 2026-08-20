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

// Load is not chosen on the character sheet — it is read off the ◇ the player has marked. End to
// end: checking an item writes the actor, the next render recomputes the band, and the radio that
// lights up is the one the marked weight lands in.

const item = (slug, weight) => new OutfitItemBuilder()
	.withSlug(slug).withName(slug).withWeight(weight).withInventoryColumn("regular").build();

function makeSheet() {
	new FakeGameBuilder().build();
	const inventory = new FakeInventoryRepository([item("armor", 3), item("tent", 4)]);
	const actor = new FakeCharacterActorBuilder()
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

const checkedLevel = sheet =>
	sheet.element.querySelector(".stonetop-outfit-load-radio:checked")?.value ?? null;
const markedText = sheet =>
	sheet.element.querySelector(".stonetop-outfit-marked")?.textContent.trim() ?? null;

beforeEach(() => { document.body.innerHTML = ""; });

describe("outfit load (integration)", () => {
	it("starts light with nothing marked", async () => {
		const { sheet } = makeSheet();
		await render(sheet);
		expect(checkedLevel(sheet)).toBe("light");
		expect(markedText(sheet)).toBe("0 ◇ marked");
	});

	it("moves the checked radio to the band the marked ◇ land in", async () => {
		const { sheet } = makeSheet();
		await render(sheet);

		const diamond = sheet.element.querySelector('.stonetop-inventory-item-check[data-slug="armor"]');
		diamond.checked = true;
		fire(diamond, "change");
		await settle();

		await render(sheet);
		expect(checkedLevel(sheet)).toBe("light");   // 3 ◇
		expect(markedText(sheet)).toBe("3 ◇ marked");

		const tent = sheet.element.querySelector('.stonetop-inventory-item-check[data-slug="tent"]');
		tent.checked = true;
		fire(tent, "change");
		await settle();

		await render(sheet);
		expect(checkedLevel(sheet)).toBe("heavy");   // 3 + 4 ◇
		expect(markedText(sheet)).toBe("7 ◇ marked");
	});

	it("counts the undefined pool's diamonds too", async () => {
		const { sheet } = makeSheet();
		await render(sheet);

		const pip = sheet.element.querySelectorAll(".stonetop-regular-pool-btn")[4]; // mark 5
		pip.checked = true;
		fire(pip, "change");
		await settle();

		await render(sheet);
		expect(checkedLevel(sheet)).toBe("normal");
		expect(markedText(sheet)).toBe("5 ◇ marked");
	});
});
