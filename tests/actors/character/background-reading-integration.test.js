// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../../fakes/FakeCompendiumMoveBuilder.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { TestPlaybookItemBuilder } from "../../fakes/TestPlaybookItemBuilder.js";
import { renderPartial } from "../../fakes/renderTemplate.js";
import { fire, settle } from "../../fakes/domEvents.js";

/**
 * Reading a background before you take it.
 *
 * A background can hand you a move of its own, linked on a row of its choice group. The playbook tab
 * draws EVERY background, taken or not, because reading them is how a player picks one — but the move
 * became an item on the actor only once that background was chosen, and `moves.bySlug` was built from
 * the actor's items alone. So the row that exists to say what Destined gives you rendered as an empty
 * `<ol>`, and the only way to find out was to commit to the choice first.
 *
 * Integration, because that is where the defect lived: every unit along the way was doing its own job
 * correctly. The grant row carried its slug, the registry answered honestly about what the character
 * owned, and the partial skipped a slug it could not resolve. What was wrong was that the sheet asked
 * the ownership registry a rendering question.
 */

const LIGHT_FINGERS = "When you **_palm something small_**, roll +DEX.";

const playbookItem = () => new TestPlaybookItemBuilder()
	.withSlug("the-fox")
	.withName("The Fox")
	.withBackgrounds([
		{ slug: "the-natural", label: "The Natural", description: "You grew up around here." },
		{ slug: "the-scoundrel", label: "The Scoundrel", description: "You never fit in.",
		  choices: { slug: "the-scoundrel", list: [
			{ type: "entry", slug: "cut-loose", content: { text: "You cut loose from your kin." }, track: { max: 1 } },
			{ type: "entry", grants: [{ type: "move", slug: "light-fingers", locations: ["inline"] }] },
		  ]}},
	])
	.build();

// The catalog the row's slug resolves against. Deliberately NOT seeded on the actor: the character
// has taken no background, so it owns nothing the Scoundrel confers — which is the whole fixture.
const catalog = () => new FakeMoveRepository([
	new FakeCompendiumMoveBuilder().withName("Light Fingers")
		.withRollStat("dex").withDescription(LIGHT_FINGERS).build(),
]);

function makeSheet() {
	new FakeGameBuilder().build();
	const actor = new FakeCharacterActorBuilder()
		.withPlaybook("the-fox")
		.withItems([playbookItem()])
		.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory({ moves: catalog() })))
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

async function renderTab(sheet) {
	const context = await sheet._prepareContext({});
	sheet.element.innerHTML = renderPartial("stonetop.tab-playbook", context);
	await sheet._onFirstRender(context, {});
	return sheet.element;
}

const html = async sheet => renderPartial("stonetop.tab-playbook", await sheet._prepareContext({}));
const tick = async el => { el.checked = true; fire(el, "change"); await settle(); };

beforeEach(() => { document.body.innerHTML = ""; });

describe("a background's move is readable before the background is taken", () => {
	it("draws the move on the untaken background's row, in full", async () => {
		const sheet = makeSheet();
		const tab = await renderTab(sheet);

		expect(tab.querySelector(`input[data-change-action="selectBackground"][value="the-scoundrel"]`).checked)
			.toBe(false);
		const rendered = tab.innerHTML;
		expect(rendered).toContain("Light Fingers");
		expect(rendered).toContain("palm something small");
		// The empty <ol> the row used to render as.
		expect(rendered).not.toMatch(/<ol class="items-list stonetop-arcanum-moves">\s*<\/ol>/);
	});

	// It is not the character's move yet, and the row must not pretend otherwise: `data-item-id` is
	// what the roll handler resolves against the ACTOR's items, and there is no such item.
	it("claims no owned item for it", async () => {
		const sheet = makeSheet();
		await renderTab(sheet);

		const snap = (await sheet._prepareContext({})).stonetop.moves.bySlug["light-fingers"];
		expect(snap.ownedId).toBeNull();
		expect(snap.selection.value).toBe(0);
	});

	// The die is a control the row has always had, and it works: CharacterMoves#roll resolves the move
	// from the catalog when the character has no copy. Trying a move you are weighing up is the point.
	it("keeps the row's die, which rolls the move from the catalog", async () => {
		const sheet = makeSheet();
		const tab = await renderTab(sheet);

		const die = tab.querySelector(`.move-rollable[data-move-slug="light-fingers"]`);
		expect(die, "the row drew no die").not.toBeNull();
		expect(await sheet.typedActor.rollMoveBySlug("light-fingers")).toBe(true);
	});

	// The one control on that row that used to do nothing at all: sendToChat found no owned item and
	// the arcana fallback had nothing to say either, so the click was silently swallowed.
	it("keeps the row's chat bubble, which posts the move from the catalog", async () => {
		const sheet = makeSheet();
		const tab = await renderTab(sheet);

		expect(tab.querySelector(`.stonetop-move-chat[data-move-slug="light-fingers"]`)).not.toBeNull();
		await sheet.typedActor.sendMoveToChat("light-fingers");
		expect(sheet.actor.chatItems.map(i => i.name)).toEqual(["Light Fingers"]);
	});

	// Taking the background is what makes it yours. The row does not change shape — it is the same
	// row, now backed by the character's own item, which is the copy the die rolls and the chat posts.
	it("becomes the character's own copy once the background is chosen", async () => {
		const sheet = makeSheet();
		const tab = await renderTab(sheet);

		await tick(tab.querySelector(`input[data-change-action="selectBackground"][value="the-scoundrel"]`));

		const snap = (await sheet._prepareContext({})).stonetop.moves.bySlug["light-fingers"];
		expect(snap.ownedId).toBeTruthy();
		expect(await html(sheet)).toContain("Light Fingers");
	});

	// One row, not two: the catalog seeds the registry and the owned item replaces its entry, so the
	// move is never listed twice under the background that grants it.
	it("draws it exactly once, taken or not", async () => {
		const sheet = makeSheet();
		const tab = await renderTab(sheet);
		const count = text => (text.match(/Light Fingers/g) ?? []).length;

		const before = count(tab.innerHTML);
		await tick(tab.querySelector(`input[data-change-action="selectBackground"][value="the-scoundrel"]`));

		expect(before).toBeGreaterThan(0);
		expect(count(await html(sheet))).toBe(before);
	});

	// The moves tab stays the character's own list. A background's move is reached on the background,
	// and one from a background nobody has taken is not the character's by any reading.
	it("keeps it off the moves tab", async () => {
		const sheet = makeSheet();
		await renderTab(sheet);

		const { categories } = (await sheet._prepareContext({})).stonetop.moves;
		expect(categories.flatMap(c => c.moves.map(m => m.name))).not.toContain("Light Fingers");
	});
});
