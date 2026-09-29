// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createStonetopSteadingSheetClass } from "../../src/actors/steading/StonetopSteadingSheet.js";
import { StonetopSteading } from "../../src/actors/steading/StonetopSteading.js";
import { createStonetopCharacterSheetClass } from "../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../src/actors/character/StonetopCharacter.js";
import { FakeSteadingBuilder } from "../fakes/FakeSteadingBuilder.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../fakes/FakeGameBuilder.js";
import { FakeMoveRepository } from "../fakes/FakeMoveRepository.js";
import { TestPlaybookItemBuilder } from "../fakes/TestPlaybookItemBuilder.js";
import { stonetopActorSheetBase } from "../fakes/foundry/stonetopActorSheetBase.js";
import { steadingRepos } from "../fakes/FakeSteadingRepos.js";
import { renderTemplate } from "../fakes/renderTemplate.js";
import { renderSheetPart } from "../fakes/renderSheetPart.js";

// The tab strip's "More", end to end on both sheets through the real shared base: tabs the strip has
// no room for are listed under More rather than squeezed; choosing one switches to it, shuts the
// menu, and brings the open tab into the strip. Geometry is stubbed — happy-dom lays nothing out — as
// a strip too narrow for all its tabs.

const WIDTHS = { "sheet-tabs": 420, "item": 90, "stonetop-tab-more": 60, "stonetop-advice-btn": 24 };
let original;
beforeEach(() => {
	document.body.innerHTML = "";
	original = Element.prototype.getBoundingClientRect;
	Element.prototype.getBoundingClientRect = function () {
		const width = Object.entries(WIDTHS).find(([cls]) => this.classList?.contains(cls))?.[1] ?? 0;
		return { width, height: 30, left: 0, top: 0, right: width, bottom: 30 };
	};
});
afterEach(() => { Element.prototype.getBoundingClientRect = original; });

async function steadingSheet() {
	const actor = new FakeSteadingBuilder().build();
	actor.typedActor = new StonetopSteading(actor, steadingRepos({ improvements: { getBySlug: async () => null }, moves: new FakeMoveRepository() }));
	await actor.typedActor.onCreate();
	const sheet = new (createStonetopSteadingSheetClass(stonetopActorSheetBase()))(actor);
	sheet.id = "st1";
	return { sheet, template: "systems/stonetop/templates/actor/steading.hbs" };
}

async function characterSheet() {
	new FakeGameBuilder().build();
	const actor = new FakeCharacterActorBuilder().withPlaybook("the-fox")
		.withItems([new TestPlaybookItemBuilder().withSlug("the-fox").withName("The Fox").build()])
		.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory())).build();
	const sheet = new (createStonetopCharacterSheetClass(stonetopActorSheetBase()))(actor);
	sheet.id = "ch1";
	return { sheet, template: "systems/stonetop/templates/actor/character.hbs" };
}

async function render({ sheet, template }, first = false) {
	document.body.append(sheet.element);
	return renderSheetPart(sheet, renderTemplate(template, await sheet._prepareContext({})), { first });
}

const strip = root => root.querySelector(".stonetop-rail-main > .sheet-tabs");
const shown = root => [...strip(root).querySelectorAll(":scope > .item")].filter(t => !t.hidden).map(t => t.dataset.tab);
const listed = root => [...strip(root).querySelectorAll(".stonetop-tab-more-item")].filter(t => !t.hidden).map(t => t.dataset.tab);
const click = el => el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

for (const [name, make] of [["the steading", steadingSheet], ["the character", characterSheet]]) {
	describe(`${name}'s tab strip (integration)`, () => {
		it("shows the tabs that fit and lists the rest under More, in order", async () => {
			const root = await render(await make(), true);
			const all = [...strip(root).querySelectorAll(":scope > .item")].map(t => t.dataset.tab);
			expect(shown(root).length).toBeGreaterThan(0);
			expect(listed(root).length).toBeGreaterThan(0);
			expect([...shown(root), ...listed(root)]).toEqual(all);
			expect(strip(root).querySelector(".stonetop-tab-more").hidden).toBe(false);
		});

		it("switches to a tab chosen from More, shuts the menu, and keeps the open tab in the strip", async () => {
			const made = await make();
			const root = await render(made, true);
			const button = strip(root).querySelector(".stonetop-tab-more-btn");
			click(button);
			expect(button.getAttribute("aria-expanded")).toBe("true");
			const last = listed(root).at(-1);
			const entry = strip(root).querySelector(`.stonetop-tab-more-item[data-tab="${last}"]`);
			click(entry);
			made.sheet.changeTab(entry.dataset.tab, entry.dataset.group);
			expect(button.getAttribute("aria-expanded")).toBe("false");
			expect(shown(root)).toContain(last);
			expect(listed(root)).not.toContain(last);
			expect(root.querySelector(`.tab[data-tab="${last}"]`).classList.contains("active")).toBe(true);
		});
	});
}
