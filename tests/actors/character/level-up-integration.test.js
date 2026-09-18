// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";

// The whole Level Up strip end to end: the pack's own steps, through CharacterAdvancement, the real
// snapshot, the real partials and the real sheet actions. The unit tests each prove one link; this
// is the one that proves they are connected — that the strip appears when the move triggers, that
// Advance writes both values, and that pressing it leaves the checklist agreeing with the character.

const LEVEL_UP = {
	_id: "level-up-id",
	name: "Level Up",
	type: "move",
	system: {
		slug: "level-up",
		moveType: "homefront",
		description: "When you **_have a quiet stretch of time at home and XP equal to (or greater than) 6 + twice your current level_**, follow these steps:\n\n- Subtract 6 + twice your current level from your XP.\n- Increase your level by 1.\n- Choose a new move from your playbook, or an insert class that you've unlocked.\n- If you are the Blessed (or have a sacred pouch) and your new level is even, increase your maximum Stock by 1.\n- If you are the Lightbearer (or have Invoke the Sun God) and your new level is even, choose a new Invocation.\n- Review your Instinct and Appearance. Change anything that no longer applies. Feel free to make up new options.",
		steps: [
			{ kind: "spend" },
			{ kind: "advance" },
			{ kind: "chooseMove", tab: "moves" },
			{ kind: "stock", possession: "sacred-pouch" },
			{ kind: "invocation", insert: "lightbearer-invocations-insert",
			  group: "lightbearer-invocations", startsKnowing: 2 },
			{ kind: "review", tab: "playbook" },
		],
	},
};

const sacredPouch = () => ({
	_id: "sacred-pouch-item", type: "possession", name: "Sacred pouch",
	system: {
		slug: "sacred-pouch", selected: true, preselected: true, outfitItems: [], pickValues: {},
		resource: { max: 3, title: "Stock", labels: [] },
		scaling: { perEvenLevel: 1, perMove: [] },
	},
});

function makeSheet({ level = 5, xp = 19, items = [] } = {}) {
	new FakeGameBuilder().build();
	const repos = new FakeRepositoryFactory({ moves: new FakeMoveRepository([], [LEVEL_UP]) });
	const actor = new FakeCharacterActorBuilder()
		.withLevel(level).withXp(xp, 8).withItems(items)
		.withTypedActor(a => new StonetopCharacter(a, repos))
		.build();
	const Base = class {
		tabGroups = {};
		element = document.createElement("form");
		render = vi.fn();
		changeTab = vi.fn();
		get actor() { return actor; }
		get typedActor() { return actor.typedActor; }
		get isEditable() { return true; }
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
	return sheet.element;
}

const action = (sheet, name) => sheet.constructor.DEFAULT_OPTIONS.actions[name];

async function press(sheet, name, target) {
	await action(sheet, name).call(sheet, { type: "click", button: 0 }, target);
}

// Opening the strip is the sheet's own view-state toggle, then a re-render — what `this.render()`
// does in play.
async function open(sheet) {
	await press(sheet, "toggleTabView", sheet.element.querySelector('[data-view-flag="levelUpOpen"]'));
	return render(sheet);
}

beforeEach(() => {
	document.body.innerHTML = "";
	// DialogV2.confirm, as the Advance control asks it. Says yes; the "asks first" behaviour is
	// asserted separately below.
	globalThis.foundry = {
		...(globalThis.foundry ?? {}),
		applications: {
			...(globalThis.foundry?.applications ?? {}),
			api: { DialogV2: { confirm: vi.fn(async () => true) } },
		},
	};
});

describe("Level Up strip (integration)", () => {
	it("says nothing at all when the move has not triggered", async () => {
		const { sheet } = makeSheet({ level: 1, xp: 2 });
		const root = await render(sheet);
		expect(root.querySelector(".stonetop-levelup")).toBeNull();
	});

	it("marks the XP track and offers the strip once the move triggers", async () => {
		const { sheet } = makeSheet({ level: 5, xp: 16 });
		const root = await render(sheet);
		expect(root.querySelector(".stonetop-resource--wide.is-full")).not.toBeNull();
		expect(root.querySelector(".stonetop-levelup.is-ready")).not.toBeNull();
	});

	it("stays collapsed until it is asked for", async () => {
		const { sheet } = makeSheet();
		const root = await render(sheet);
		expect(root.querySelector(".stonetop-levelup-panel")).toBeNull();
		expect(root.querySelector(".stonetop-levelup-toggle").getAttribute("aria-expanded")).toBe("false");
	});

	it("opens on the move's own words, with the arithmetic done", async () => {
		const { sheet } = makeSheet({ level: 5, xp: 19 });
		await render(sheet);
		const root = await open(sheet);

		expect(root.querySelector(".stonetop-levelup-gloss").textContent.trim())
			.toContain("have a quiet stretch of time at home");
		// The book's own bullets, lifted from the description — the pack carries no second copy.
		expect(root.querySelector('[data-kind="chooseMove"]').textContent)
			.toContain("Choose a new move from your playbook, or an insert class that you've unlocked.");
		expect(root.querySelector('[data-kind="review"]').textContent)
			.toContain("Review your Instinct and Appearance.");
	});

	// The XP track reads 19 / 16 three lines above, so restating "6 + twice your current level" is
	// the formula the reader has just been shown the answer to.
	it("names the advance row itself, and states what the press costs and buys on one line", async () => {
		const { sheet } = makeSheet({ level: 5, xp: 19 });
		await render(sheet);
		const root = await open(sheet);

		// The harness's localize returns the key (see FakeI18n), so the key is what renders — which is
		// the claim: this row is labelled from a UI string, not from pack prose. `has` proves the
		// string is really in en.json, since a key passed as DATA is invisible to the template sweep.
		const row = root.querySelector('[data-kind="advance"]');
		expect(row.querySelector(".stonetop-levelup-text").textContent.trim())
			.toBe("stonetop.character.levelUp.advanceStep");
		expect(game.i18n.has("stonetop.character.levelUp.advanceStep")).toBe(true);
		expect(row.textContent).not.toContain("Subtract 6 + twice your current level");
		expect(row.querySelector(".stonetop-levelup-figure").textContent.trim())
			.toBe("16 XP: 19 → 3 · Level 5 → 6");
	});

	// Two of the book's bullets, one act, one button.
	it("draws the first two bullets as a single row", async () => {
		const { sheet } = makeSheet({ level: 5, xp: 19 });
		await render(sheet);
		const root = await open(sheet);

		expect(root.querySelectorAll('[data-kind="advance"]')).toHaveLength(1);
		expect(root.querySelector('[data-kind="spend"]')).toBeNull();
		expect(root.querySelectorAll(".stonetop-levelup-advance")).toHaveLength(1);
	});

	it("points at the tab that answers each step it cannot do", async () => {
		const { sheet } = makeSheet({ level: 6, xp: 3 });
		await render(sheet);
		const root = await open(sheet);

		const targets = [...root.querySelectorAll(".stonetop-levelup-goto")].map(b => b.dataset.tab);
		expect(targets).toEqual(["moves", "playbook"]);
	});

	it("changes tab when a step's link is pressed, writing nothing", async () => {
		const { sheet, actor } = makeSheet({ level: 6, xp: 3 });
		await render(sheet);
		const root = await open(sheet);

		await press(sheet, "goToTab", root.querySelector('[data-kind="chooseMove"] .stonetop-levelup-goto'));

		expect(sheet.changeTab).toHaveBeenCalledWith("moves", "primary");
		expect(actor.system.attributes.level).toBe(6);
	});

	it("advances the character when the control is pressed", async () => {
		const { sheet, actor } = makeSheet({ level: 5, xp: 19 });
		await render(sheet);
		const root = await open(sheet);

		await press(sheet, "advance", root.querySelector(".stonetop-levelup-advance"));

		expect(actor.system.attributes.xp.value).toBe(3);
		expect(actor.system.attributes.level).toBe(6);
	});

	it("asks before it writes, with the numbers in the question", async () => {
		const { sheet, actor } = makeSheet({ level: 5, xp: 19 });
		await render(sheet);
		const root = await open(sheet);
		foundry.applications.api.DialogV2.confirm.mockResolvedValueOnce(false);

		await press(sheet, "advance", root.querySelector(".stonetop-levelup-advance"));

		const [{ content }] = foundry.applications.api.DialogV2.confirm.mock.calls[0];
		expect(content).toContain("16");
		expect(content).toContain("3");
		expect(actor.system.attributes.level).toBe(5);
	});

	it("ticks the spent steps off and stays open on what is still owed", async () => {
		const { sheet } = makeSheet({ level: 5, xp: 19 });
		await render(sheet);
		await open(sheet);
		await press(sheet, "advance", sheet.element.querySelector(".stonetop-levelup-advance"));
		const root = await render(sheet);

		expect(root.querySelector('[data-kind="advance"]').classList).toContain("is-done");
		// The next level-up's cost, quoted under a ticked step, reads as a second advance on offer.
		expect(root.querySelector('[data-kind="advance"] .stonetop-levelup-figure')).toBeNull();
		expect(root.querySelector('[data-kind="chooseMove"]').classList).not.toContain("is-done");
		expect(root.querySelector(".stonetop-levelup")).not.toBeNull();
		expect(root.querySelector(".stonetop-levelup.is-ready")).toBeNull();
		expect(root.querySelector(".stonetop-levelup-advance")).toBeNull();
	});

	it("reports the Stock the possession's own scaling is about to give, offering no control", async () => {
		const { sheet } = makeSheet({ level: 5, xp: 19, items: [sacredPouch()] });
		await render(sheet);
		const root = await open(sheet);

		const stock = root.querySelector('[data-kind="stock"]');
		expect(stock.querySelector(".stonetop-levelup-figure").textContent.trim())
			.toBe("Maximum Stock 5 → 6, applied for you.");
		expect(stock.querySelector("button")).toBeNull();
	});

	it("leaves out the even-level clauses for a character neither applies to", async () => {
		const { sheet } = makeSheet({ level: 5, xp: 19 });
		await render(sheet);
		const root = await open(sheet);

		expect(root.querySelector('[data-kind="stock"]')).toBeNull();
		expect(root.querySelector('[data-kind="invocation"]')).toBeNull();
	});
});
