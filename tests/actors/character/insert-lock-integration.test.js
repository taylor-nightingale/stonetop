// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";
import { fire, settle } from "../../fakes/domEvents.js";

// An insert tab is instinct plus choice groups, so "locked" there is the same condensing the
// playbook tab does — through the same flag, the same button and the same partial. What is its own
// is the KEY: one flag per insert slug, so locking Invocations leaves the Ghost tab alone.

const invocations = () => ({
	_id: "invocations-item", type: "insert", name: "Invocations",
	system: { slug: "invocations", choiceValues: {}, choices: [{ slug: "invocations", list: [
		{ type: "entry", slug: "blinding", track: { max: 1 },
		  content: { title: null, subtitle: "Blinding Light", subtitleNote: "(ongoing)",
		             text: "Your light blazes." } },
		{ type: "entry", slug: "cleansing", track: { max: 1 },
		  content: { title: null, subtitle: "Cleansing Light", text: "Your light dispels magic." } },
	]}]},
});

const ghost = () => ({
	_id: "ghost-item", type: "insert", name: "Ghost",
	system: { slug: "ghost", choiceValues: {}, choices: [{ slug: "purpose", list: [
		{ type: "entry", slug: "vengeance", track: { max: 1 }, content: { text: "Vengeance." } },
	]}]},
});

function makeSheet(items) {
	new FakeGameBuilder().build();
	const actor = new FakeCharacterActorBuilder()
		.withItems(items)
		.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory()))
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
	return new (createStonetopCharacterSheetClass(Base))();
}

// Render the whole sheet, so the per-insert flag is threaded by the real template, not the test.
async function render(sheet) {
	const context = await sheet._prepareContext({});
	sheet.element.innerHTML = renderTemplate("systems/stonetop/templates/actor/character.hbs", context);
	await sheet._onFirstRender(context, {});
	return sheet.element;
}

async function lock(sheet, slug) {
	const def = sheet.constructor.DEFAULT_OPTIONS.actions.toggleTabView;
	const button = sheet.element.querySelector(`[data-view-flag="insertLocked-${slug}"]`);
	await def.call(sheet, { type: "click", button: 0 }, button);
	return renderTemplate("systems/stonetop/templates/actor/character.hbs", await sheet._prepareContext({}));
}

const tabOf = (html, slug) => {
	const at = html.indexOf(`data-tab="insert-${slug}"`);
	const end = html.indexOf(`data-tab="insert-`, at + 1);
	return at < 0 ? "" : html.slice(at, end < 0 ? undefined : end);
};

beforeEach(() => { document.body.innerHTML = ""; });

describe("insert tab lock (integration)", () => {
	it("condenses the insert's groups, keeping each invocation's name", async () => {
		const sheet = makeSheet([invocations()]);
		const root = await render(sheet);
		const box = root.querySelector(`.stonetop-cg-track[data-cg-option="blinding"]`);
		box.checked = true;
		fire(box, "change");
		await settle();

		const tab = tabOf(await lock(sheet, "invocations"), "invocations");

		expect(tab).toContain("Blinding Light");
		expect(tab).toContain("(ongoing)");
		expect(tab).toContain("Your light blazes.");
		expect(tab).toContain("stonetop-choice-tick");
		expect(tab).not.toContain("Cleansing Light");     // never marked
		expect(tab).not.toContain("stonetop-cg-track");   // nothing left to tick
	});

	// The flag is keyed by slug precisely so the tabs don't move together.
	it("locks one insert without touching the others", async () => {
		const sheet = makeSheet([invocations(), ghost()]);
		await render(sheet);

		const html = await lock(sheet, "invocations");

		expect(tabOf(html, "invocations")).not.toContain("stonetop-cg-track");
		expect(tabOf(html, "ghost")).toContain("stonetop-cg-track");
	});

	it("offers the toggle on every insert tab, through the shared action", async () => {
		const sheet = makeSheet([invocations(), ghost()]);
		const html = renderTemplate("systems/stonetop/templates/actor/character.hbs", await sheet._prepareContext({}));

		for (const slug of ["invocations", "ghost"]) {
			expect(tabOf(html, slug)).toContain(`data-action="toggleTabView"`);
			expect(tabOf(html, slug)).toContain(`data-view-flag="insertLocked-${slug}"`);
		}
	});
});
