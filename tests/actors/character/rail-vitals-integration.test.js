// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";
import { OpenDisclosures } from "../../../src/utils/OpenDisclosures.js";

// The rail's identity, state and advancement, end to end (D7, D9): the portrait with Armor, Level and
// Damage on it; hit points and experience as bars that stay editable; and the conditional moves, each
// present only while its condition holds.

const seeded = (slug, name, categoryKey, system = {}) => ({
	_id: `m-${slug}`, type: "move", name,
	system: { slug, categoryKey, moveType: categoryKey, acquired: true, instanceCount: 1, description: "", ...system },
});

const SPECIAL = [
	seeded("advantage-disadvantage", "Advantage/Disadvantage", "special"),
	seeded("burn-brightly", "Burn Brightly", "special", { description: "When you **_have enough XP to Level Up_**, spend 2 XP for +1." }),
	seeded("deaths-door", "Death's Door", "special", { rollStat: "prompt", description: "When **_you are dying_**, roll." }),
	seeded("end-of-session", "End of Session", "special"),
	seeded("defy-danger", "Defy Danger", "basic", { rollStat: "ask" }),
];

const DARK_SUCCOR = seeded("dark-succor", "Dark Succor", "insert-thrall", { rollStat: "favor", replaces: "deaths-door" });

const LEVEL_UP = {
	_id: "level-up-id", name: "Level Up", type: "move",
	system: {
		slug: "level-up", moveType: "homefront",
		description: "When you **_have a quiet stretch of time at home and XP equal to (or greater than) 6 + twice your current level_**, follow these steps:\n\n- Subtract 6 + twice your current level from your XP.\n- Increase your level by 1.\n- Choose a new move from your playbook, or an insert class that you've unlocked.",
		steps: [{ kind: "spend" }, { kind: "advance" }, { kind: "chooseMove", tab: "moves" }],
	},
};

function makeSheet({ hp = [13, 18], xp = 7, level = 5, items = [] } = {}) {
	new FakeGameBuilder().build();
	const repos = new FakeRepositoryFactory({ moves: new FakeMoveRepository([], [LEVEL_UP]) });
	const actor = new FakeCharacterActorBuilder()
		.withLevel(level).withXp(xp, 6 + 2 * level).withArmor(1)
		.withItems([...SPECIAL, ...items])
		.withTypedActor(a => new StonetopCharacter(a, repos))
		.build();
	actor.system.attributes.hp = { value: hp[0], max: hp[1] };
	actor.img = "icons/portrait.webp";
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
	};
	return { sheet: new (createStonetopCharacterSheetClass(Base))(), actor };
}

async function render(sheet) {
	const context = await sheet._prepareContext({});
	sheet.element.innerHTML = renderTemplate("systems/stonetop/templates/actor/character.hbs", context);
	sheet.openDisclosures.restore(sheet.element);
	document.body.replaceChildren(sheet.element);
	return sheet.element;
}

const rail = root => root.querySelector(".stonetop-rail");
const band = root => root.querySelector(".stonetop-band");
const rowSlugs = el => [...el.querySelectorAll("li.stonetop-mrow")].map(li => li.dataset.slug);
const action = (sheet, name) => sheet.constructor.DEFAULT_OPTIONS.actions[name];

beforeEach(() => { document.body.innerHTML = ""; });

describe("the rail's identity (integration)", () => {
	it("shows the portrait, which still changes the picture", async () => {
		const root = await render(makeSheet().sheet);
		const button = rail(root).querySelector(".stonetop-rail-identity [data-action='editImage']");
		expect(button.querySelector("img[data-edit='img']").getAttribute("src")).toBe("icons/portrait.webp");
	});

	it("puts Armor, Level and Damage on it, each still a field", async () => {
		const root = await render(makeSheet().sheet);
		const cluster = rail(root).querySelector(".stonetop-cluster");
		expect(cluster.querySelector("[data-change-action='armor']").value).toBe("1");
		expect(cluster.querySelector("[data-change-action='level']").value).toBe("5");
		expect(cluster.querySelector("[data-change-action='damage']")).not.toBeNull();
		expect(cluster.querySelector("button.rollable[data-roll='damage']")).not.toBeNull();
	});

	it("takes the portrait and the three vitals out of the band", async () => {
		const root = await render(makeSheet().sheet);
		expect(band(root).querySelector(".stonetop-actor-portrait")).toBeNull();
		expect(band(root).querySelector(".stonetop-resource-row--vitals")).toBeNull();
	});
});

describe("hit points and experience (integration)", () => {
	it("draws hit points as a bar with current and maximum both editable", async () => {
		const root = await render(makeSheet().sheet);
		const hp = rail(root).querySelector(".stonetop-meter--hp");
		expect(hp.querySelector("[role='meter']").getAttribute("aria-valuenow")).toBe("13");
		expect(hp.querySelector("[data-change-action='hp']").value).toBe("13");
		expect(hp.querySelector("[data-change-action='maxHp']").value).toBe("18");
		expect(hp.querySelector("[data-change-action='hp']").closest(".stonetop-stepper")
			.querySelectorAll(".stonetop-stepper-btn")).toHaveLength(2);
	});

	// The threshold is derived from level and never typed.
	it("draws experience as a bar whose threshold is a readout", async () => {
		const root = await render(makeSheet({ xp: 7 }).sheet);
		const xp = rail(root).querySelector(".stonetop-meter--xp");
		expect(xp.querySelector("[data-change-action='xp']").value).toBe("7");
		expect(xp.querySelector(".stonetop-meter-max").textContent).toBe("16");
		expect(xp.querySelector("[data-change-action='xp']").closest(".stonetop-stepper")).not.toBeNull();
	});

	it("says what is spare past the threshold", async () => {
		const root = await render(makeSheet({ xp: 21 }).sheet);
		expect(rail(root).querySelector(".stonetop-meter--xp .stonetop-meter-tick")).not.toBeNull();
		expect(rail(root).querySelector(".stonetop-meter--xp .stonetop-meter-note").textContent).toContain("5");
	});
});

describe("the move at zero hit points (integration)", () => {
	it("is not there while the character is not dying", async () => {
		const root = await render(makeSheet().sheet);
		expect(rail(root).querySelector(".stonetop-conditional--dire")).toBeNull();
	});

	it("is Death's Door, as a row that rolls, once hit points reach zero", async () => {
		const root = await render(makeSheet({ hp: [0, 18] }).sheet);
		const dire = rail(root).querySelector(".stonetop-conditional--dire");
		expect(rowSlugs(dire)).toEqual(["deaths-door"]);
		expect(dire.querySelector("button.rollable").dataset.roll).toBe("prompt");
	});

	it("is the insert's own move for a character already dead once", async () => {
		const root = await render(makeSheet({ hp: [0, 18], items: [DARK_SUCCOR] }).sheet);
		expect(rowSlugs(rail(root).querySelector(".stonetop-conditional--dire"))).toEqual(["dark-succor"]);
	});
});

describe("advancement (integration)", () => {
	it("offers nothing below the threshold, with nothing owed", async () => {
		const root = await render(makeSheet({ xp: 2, level: 1 }).sheet);
		expect(rail(root).querySelector(".stonetop-levelup")).toBeNull();
		expect(rowSlugs(rail(root))).not.toContain("burn-brightly");
	});

	it("offers Level Up at the threshold, saying first that it is done at home", async () => {
		const root = await render(makeSheet({ xp: 16 }).sheet);
		const offer = rail(root).querySelector(".stonetop-levelup");
		expect(offer.querySelector(".stonetop-levelup-home").textContent).toContain("stonetop.character.levelUp.onlyAtHome");
		expect(offer.querySelector(".stonetop-levelup-gloss").textContent).toContain("a quiet stretch of time at home");
	});

	it("opens the checklist, Advance and all, from the offer", async () => {
		const { sheet } = makeSheet({ xp: 16 });
		let root = await render(sheet);
		await action(sheet, "toggleTabView").call(sheet, new Event("click"),
			rail(root).querySelector(".stonetop-levelup-toggle"));
		root = await render(sheet);
		expect(rail(root).querySelector(".stonetop-levelup-panel .stonetop-levelup-advance")).not.toBeNull();
	});

	it("routes to the Moves tab while a level taken still owes a move", async () => {
		const { sheet } = makeSheet({ xp: 0, level: 3 });
		const root = await render(sheet);
		const route = rail(root).querySelector(".stonetop-levelup-choose");
		expect(route.dataset.action).toBe("goToTab");
		expect(route.dataset.tab).toBe("moves");
		expect(rail(root).querySelector(".stonetop-levelup-home")).toBeNull();
	});

	it("offers Burn Brightly at the threshold, open, as the other choice", async () => {
		const root = await render(makeSheet({ xp: 16 }).sheet);
		const spend = rail(root).querySelector(".stonetop-conditional--spend");
		expect(spend.querySelector(".stonetop-conditional-label").textContent).toBe("stonetop.character.levelUp.orSpend");
		const row = spend.querySelector('li[data-slug="burn-brightly"]');
		expect(row.querySelector(".stonetop-move-body").hidden).toBe(false);
	});

	it("routes to End of Session beside experience", async () => {
		const root = await render(makeSheet().sheet);
		const route = rail(root).querySelector(".stonetop-rail-route [data-move-slug='end-of-session']");
		expect(route.dataset.action).toBe("openMoveBySlug");
		expect(route.textContent).toBe("End of Session");
	});
});

describe("the special moves' places (integration)", () => {
	it("draws no special-moves group in the rail", async () => {
		const root = await render(makeSheet().sheet);
		const titles = [...rail(root).querySelectorAll(".stonetop-bar-title")].map(t => t.textContent);
		expect(titles).not.toContain("stonetop.character.moves.specialMoves");
	});

	// Advantage/Disadvantage is explained where the mode is chosen: the roll dialog's ?.
	it("leaves Advantage/Disadvantage, and the roll mode, off the band", async () => {
		const root = await render(makeSheet().sheet);
		expect(band(root).querySelector(".stonetop-rollmode")).toBeNull();
		expect(band(root).querySelector("[data-move-slug='advantage-disadvantage']")).toBeNull();
	});
});
