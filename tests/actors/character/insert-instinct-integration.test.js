// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { TestPlaybookItemBuilder } from "../../fakes/TestPlaybookItemBuilder.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";
import { fire, settle } from "../../fakes/domEvents.js";

// One instinct, two documents offering it. End to end, through the real sheet wiring: what the
// player does on an insert tab has to land in the insert's own box AND in the playbook's, which is
// where the character's instinct is read from.

const INSERT_INSTINCT = { slug: "instinct", list: [{ type: "pick", pickCount: 1, options: [
	{ slug: "denial",    content: { title: "Denial",    text: "To refuse to accept that you are dead." } },
	{ slug: "obsession", content: { title: "Obsession", text: "To pursue your purpose." } },
]}]};

const PLAYBOOK_INSTINCT = { slug: "instinct", list: [{ type: "pick", pickCount: 1, options: [
	{ slug: "conscience", content: { title: "Conscience", text: "To try to do right." } },
]}]};

const revenant = () => ({
	_id: "revenant-item", type: "insert", name: "Revenant",
	system: { slug: "revenant", choiceValues: {}, instinct: INSERT_INSTINCT, choices: [] },
});

const playbook = () => new TestPlaybookItemBuilder()
	.withSlug("the-fox").withName("The Fox").withInstinct(PLAYBOOK_INSTINCT).build();

function makeSheet() {
	new FakeGameBuilder().build();
	const actor = new FakeCharacterActorBuilder()
		.withPlaybook("the-fox")
		.withItems([playbook(), revenant()])
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
	return { sheet: new (createStonetopCharacterSheetClass(Base))(), actor };
}

async function render(sheet) {
	const context = await sheet._prepareContext({});
	sheet.element.innerHTML = renderTemplate("systems/stonetop/templates/actor/character.hbs", context);
	await sheet._onFirstRender(context, {});
	return context;
}

const valuesOf = (actor, id) => [...actor.items].find(i => i._id === id)?.system?.choiceValues ?? {};
const insertBox = sheet => sheet.element.querySelector(`[data-insert-item-id] .stonetop-instinct-custom`);
const playbookBox = sheet => sheet.element.querySelector(`.tab.playbook .stonetop-instinct-custom`);

beforeEach(() => { document.body.innerHTML = ""; });

describe("insert instinct (integration)", () => {
	it("saves a custom instinct typed on an insert to that insert, and to the character", async () => {
		const { sheet, actor } = makeSheet();
		await render(sheet);

		const box = insertBox(sheet);
		box.value = "to finish what I started";
		fire(box, "change");
		await settle();

		expect(valuesOf(actor, "revenant-item").instinct.__custom).toBe("to finish what I started");
		expect(valuesOf(actor, "playbook-item").instinct.__custom).toBe("to finish what I started");
	});

	// The bug: it reached the playbook but not the insert, so the box it was typed into came back
	// empty on the next render.
	it("reads that instinct back into the insert's own box", async () => {
		const { sheet } = makeSheet();
		await render(sheet);

		const box = insertBox(sheet);
		box.value = "to finish what I started";
		fire(box, "change");
		await settle();

		const context = await render(sheet);
		expect(context.stonetop.inserts[0].instinctSelected).toBe("to finish what I started");
		expect(insertBox(sheet).value).toBe("to finish what I started");
	});

	it("puts an instinct picked on an insert into the playbook's box, label and all", async () => {
		const { sheet, actor } = makeSheet();
		await render(sheet);

		const option = sheet.element.querySelector(`[data-insert-item-id] .stonetop-cg-pick[data-cg-option="denial"]`);
		option.checked = true;
		fire(option, "change");
		await settle();

		expect(valuesOf(actor, "revenant-item").instinct.denial).toBe(1);
		expect(valuesOf(actor, "playbook-item").instinct.__custom)
			.toBe("Denial — To refuse to accept that you are dead.");
		expect((await render(sheet)).stonetop.playbook.instinctSelected)
			.toBe("Denial — To refuse to accept that you are dead.");
		expect(playbookBox(sheet).value).toBe("Denial — To refuse to accept that you are dead.");
		expect(insertBox(sheet).value).toBe("Denial — To refuse to accept that you are dead.");
	});

	// The playbook's own box still writes to the playbook, not to whichever insert exists.
	it("leaves the insert alone when the instinct is typed on the playbook tab", async () => {
		const { sheet, actor } = makeSheet();
		await render(sheet);

		const box = playbookBox(sheet);
		box.value = "to take what isn't yours";
		fire(box, "change");
		await settle();

		expect(valuesOf(actor, "playbook-item").instinct.__custom).toBe("to take what isn't yours");
		expect(valuesOf(actor, "revenant-item").instinct?.__custom).toBeUndefined();
	});
});
