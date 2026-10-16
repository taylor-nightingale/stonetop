// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";
import { OpenDisclosures } from "../../../src/utils/OpenDisclosures.js";

// The Arcana tab, end to end (D13): what the character holds, listed beside the one card being read.
// Real partials over a real character's snapshot, through the sheet's own action and restore.

const arcanum = (slug, name, { major = false, flipped = false, backTitle = "Mysteries" } = {}) => ({
	_id: `${slug}-item`, type: "arcanum", name,
	system: {
		slug, major, flipped, choiceValues: {},
		front: { item: null, choices: [] },
		back:  { title: backTitle, item: null, choices: [] },
	},
});

const SATCHEL = (opts) => arcanum("beaded-satchel", "A beaded satchel", { backTitle: "Satchel of Plenty", ...opts });
const KEY     = () => arcanum("the-key", "A... key?", { backTitle: "The Eye, Opened" });
const MINDGEM = () => arcanum("mindgem", "Mindgem", { major: true });

function makeSheet(...items) {
	new FakeGameBuilder().build();
	const actor = new FakeCharacterActorBuilder()
		.withItems(items)
		.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory()))
		.build();
	const Base = class {
		tabGroups = {};
		element = document.createElement("form");
		openDisclosures = new OpenDisclosures();
		render = vi.fn();
		changeTab = vi.fn();
		get actor() { return actor; }
		get typedActor() { return actor.typedActor; }
		get isEditable() { return true; }
		_getTabsConfig(group) { return this.constructor.TABS[group] ?? null; }
		async _prepareContext() {
			return { tabs: {}, actor, editable: true, sheetIdPrefix: "sheet", stonetop: await actor.typedActor.buildSnapshot() };
		}
		async _onFirstRender() {}
		_onRender() {}
		restoreViewState() {}
		async _onDropItem() {}
	};
	return { sheet: new (createStonetopCharacterSheetClass(Base))(), actor };
}

async function render(sheet) {
	const context = await sheet._prepareContext({});
	sheet.element.innerHTML = renderTemplate("systems/stonetop/templates/actor/character.hbs", context);
	document.body.replaceChildren(sheet.element);
	sheet.restoreViewState(sheet.element);
	sheet._onRender(context, {});
	return sheet.element;
}

const tab = root => root.querySelector('.tab[data-tab="arcana"]');
const lines = root => [...tab(root).querySelectorAll(".stonetop-arcana-pick")];
const shown = root => [...tab(root).querySelectorAll(".stonetop-arcana-reader > .stonetop-arcanum-card")]
	.filter(c => !c.hidden).map(c => c.dataset.slug);
const current = root => lines(root).filter(b => b.getAttribute("aria-current") === "true").map(b => b.dataset.slug);
const choose = async (sheet, slug) => {
	const target = tab(sheet.element).querySelector(`.stonetop-arcana-pick[data-slug="${slug}"]`);
	await sheet.constructor.DEFAULT_OPTIONS.actions[target.dataset.action].call(sheet, new Event("click"), target);
};

beforeEach(() => { document.body.innerHTML = ""; });

describe("the Arcana tab's list (integration)", () => {
	it("lists the majors first, each group under its own bar", async () => {
		const { sheet } = makeSheet(SATCHEL(), MINDGEM(), KEY());
		const root = await render(sheet);
		expect(lines(root).map(b => b.dataset.slug)).toEqual(["mindgem", "beaded-satchel", "the-key"]);
		expect([...tab(root).querySelectorAll(".stonetop-arcana-group .stonetop-bar-title")]).toHaveLength(2);
	});

	it("shows the first card, and marks its line as the one being read", async () => {
		const { sheet } = makeSheet(SATCHEL(), MINDGEM());
		const root = await render(sheet);
		expect(shown(root)).toEqual(["mindgem"]);
		expect(current(root)).toEqual(["mindgem"]);
	});

	it("names a flipped arcanum's mystery under its name", async () => {
		const { sheet } = makeSheet(SATCHEL({ flipped: true }), MINDGEM());
		const root = await render(sheet);
		const line = tab(root).querySelector('.stonetop-arcana-pick[data-slug="beaded-satchel"]').closest("li");
		expect(line.querySelector(".stonetop-arcana-line-face").textContent).toContain("Satchel of Plenty");
	});

	it("points each line at the card it opens", async () => {
		const { sheet } = makeSheet(SATCHEL(), MINDGEM());
		const root = await render(sheet);
		for (const line of lines(root))
			expect(root.querySelector(`#${line.getAttribute("aria-controls")}`)?.dataset.slug).toBe(line.dataset.slug);
	});
});

describe("choosing an arcanum (integration)", () => {
	it("shows its card, without drawing the sheet again", async () => {
		const { sheet } = makeSheet(SATCHEL(), MINDGEM(), KEY());
		const root = await render(sheet);
		await choose(sheet, "the-key");
		expect(shown(root)).toEqual(["the-key"]);
		expect(current(root)).toEqual(["the-key"]);
		expect(sheet.render).not.toHaveBeenCalled();
	});

	// A pip ticked on the card re-renders the whole tab; the reader stays on the card they were reading.
	it("keeps the chosen card through a re-render", async () => {
		const { sheet } = makeSheet(SATCHEL(), MINDGEM(), KEY());
		await render(sheet);
		await choose(sheet, "beaded-satchel");
		const root = await render(sheet);
		expect(shown(root)).toEqual(["beaded-satchel"]);
	});

	it("goes to the first card when the one being read is removed", async () => {
		const { sheet } = makeSheet(SATCHEL(), MINDGEM(), KEY());
		await render(sheet);
		await choose(sheet, "the-key");
		await sheet.typedActor.removeArcanum("the-key");
		const root = await render(sheet);
		expect(shown(root)).toEqual(["mindgem"]);
	});

	it("shows an arcanum dropped on this sheet", async () => {
		const { sheet } = makeSheet(SATCHEL(), MINDGEM());
		await render(sheet);
		const dropped = KEY();
		await sheet._onDropItem({}, { type: "arcanum", system: dropped.system, parent: null, toObject: () => dropped });
		const root = await render(sheet);
		expect(shown(root)).toEqual(["the-key"]);
	});
});

// A card that grants a follower prints its whole stat block, read-only, and says where the follower
// goes once marked; the follower is edited on the Followers tab. The editor inside the card was a
// frame within a frame, and a second copy of every field.
describe("a follower an arcanum grants (integration)", () => {
	const VOID = (system = {}) => ({
		_id: "void-item", type: "follower", name: "Void elemental",
		system: { slug: "void-elemental", owned: true, showOnTab: false, tagList: ["primordial"],
			hp: { value: 15, max: 15 }, armor: "1 (lacks organs)", damage: "void touch", instinct: "to rage at all things",
			specialQuality: "immune to most harm", moves: "Manifest as a black hole in reality",
			cost: "", notes: "", loyalty: { value: 0, max: 3 }, choiceValues: {}, ...system },
	});
	const CROWN = (locations = ["inline", "tab"]) => {
		const crown = arcanum("oversized-crown", "An oversized crown", { flipped: true, backTitle: "Void Elemental" });
		crown.system.back.choices = [{ slug: "crown", list: [{ type: "entry", slug: "void-elemental",
			grants: [{ type: "follower", slug: "void-elemental", locations }], content: {}, track: { max: 1 } }] }];
		return crown;
	};
	const block = async (...items) => {
		const { sheet } = makeSheet(...items);
		const root = await render(sheet);
		return tab(root).querySelector('.stonetop-arcanum-card[data-slug="oversized-crown"] .stonetop-follower-stat-block');
	};

	it("prints the follower's whole stat block", async () => {
		const text = (await block(CROWN(), VOID())).textContent;
		for (const part of ["Void elemental", "primordial", "15/15", "1 (lacks organs)", "void touch",
			"to rage at all things", "immune to most harm", "Manifest as a black hole in reality"])
			expect(text).toContain(part);
	});

	it("prints it read-only, not as the follower's editor", async () => {
		const { sheet } = makeSheet(CROWN(), VOID());
		const card = tab(await render(sheet)).querySelector('.stonetop-arcanum-card[data-slug="oversized-crown"]');
		expect(card.querySelector(".stonetop-follower-card")).toBeNull();
		expect(card.querySelector(".stonetop-follower-stat-block input, .stonetop-follower-stat-block textarea")).toBeNull();
	});

	it("keeps its loyalty live, since loyalty is spent in play", async () => {
		expect((await block(CROWN(), VOID())).querySelectorAll('[data-action="followerLoyaltyPip"]')).toHaveLength(3);
	});

	it("says that marking puts the follower on the Followers tab", async () => {
		expect((await block(CROWN(), VOID())).textContent).toContain("stonetop.arcana.followerJoinsHint");
	});

	it("says the follower is there once it is", async () => {
		const text = (await block(CROWN(), VOID({ showOnTab: true }))).textContent;
		expect(text).toContain("stonetop.arcana.followerJoined");
		expect(text).not.toContain("stonetop.arcana.followerJoinsHint");
	});

	// The Ring stays on its card: saying it would join the tab would be untrue.
	it("says nothing of the tab for a follower that stays on its card", async () => {
		const text = (await block(CROWN(["inline"]), VOID())).textContent;
		expect(text).not.toContain("stonetop.arcana.followerJoinsHint");
		expect(text).not.toContain("stonetop.arcana.followerJoined");
	});
});

describe("a lone arcanum (integration)", () => {
	it("is its card alone, with no list to choose from", async () => {
		const { sheet } = makeSheet(MINDGEM());
		const root = await render(sheet);
		expect(tab(root).querySelector(".stonetop-arcana-list")).toBeNull();
		expect(shown(root)).toEqual(["mindgem"]);
	});
});
