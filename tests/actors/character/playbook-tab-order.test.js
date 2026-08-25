// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from "vitest";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { TestPlaybookItemBuilder } from "../../fakes/TestPlaybookItemBuilder.js";
import { renderPartial } from "../../fakes/renderTemplate.js";

// The playbook tab is filled in top to bottom: the fixed sections a character picks first
// (background, instinct, appearance, origin) share the two-column block, and the playbook's own
// lore questions stand apart below it — a block of their own behind a divider, the way the
// introductions do. Order here is the reading order of the sheet, and nothing else asserts it.

const playbookItem = () => new TestPlaybookItemBuilder()
	.withSlug("the-fox")
	.withName("The Fox")
	.withBackgrounds([{ slug: "the-natural", label: "The Natural", description: "You grew up around here." }])
	.withInstinct({ slug: "instinct", list: [
		{ type: "pick", pickCount: 1, options: [{ slug: "take", text: "To take what isn't yours" }] },
	]})
	.withAppearance({ slug: "appearance", list: [
		{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "young-pup", text: "young pup" }] },
	]})
	.withChoices([{ slug: "tall-tales", list: [
		{ type: "entry", content: { title: "There Was That Time You…", text: "Mix and match." } },
		{ type: "entry", slug: "great-wood", content: { text: "… got lost in the Great Wood." }, track: { max: 1 } },
	]}])
	.withOrigin([{ region: "Stonetop", names: ["Bhelu"] }])
	.withIntroductions({ step3: "Describe your knives.", step4: { slug: "intro-npc", list: [
		{ type: "entry", slug: "favour", content: { text: "Who do you owe a favour?" }, input: { type: "inline" } },
	]}})
	.build();

// What each section renders that nothing else does — the tab has no per-section wrapper class to
// read, so its own controls stand for it.
const MARKERS = [
	["background", `[data-change-action="selectBackground"]`],
	["instinct",   `.stonetop-instinct-section`],
	["appearance", `[data-cg-context="appearance"]`],
	["origin",     `[data-change-action="selectOrigin"]`],
];

/** The sections a block renders, in document order, one entry each. */
const sections = (root) => {
	const names = [...root.querySelectorAll(MARKERS.map(([, sel]) => sel).join(","))]
		.map(el => MARKERS.find(([, sel]) => el.matches(sel))[0]);
	return names.filter((name, i) => name !== names[i - 1]);
};

describe("playbook tab section order", () => {
	let tab;

	beforeAll(async () => {
		new FakeGameBuilder().build();
		const actor = new FakeCharacterActorBuilder()
			.withPlaybook("the-fox")
			.withItems([playbookItem()])
			.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory()))
			.build();
		tab = document.createElement("div");
		tab.innerHTML = renderPartial("stonetop.tab-playbook", {
			tabs: {}, actor, editable: true, viewFlags: {},
			stonetop: await actor.typedActor.buildSnapshot(),
		});
	});

	// The columns hold what a character picks, in the order the playbook asks for it.
	it("puts background, instinct, appearance and origin in the two-column block, in that order", () => {
		expect(sections(tab.querySelector(".stonetop-playbook-columns")))
			.toEqual(["background", "instinct", "appearance", "origin"]);
	});

	it("keeps the lore groups out of that block", () => {
		expect(tab.querySelector(".stonetop-playbook-columns").querySelector(".stonetop-choice-section"))
			.toBeNull();
	});

	// A block of its own behind a divider — the shape the introductions already have.
	it("stands the lore groups apart, below the picks and above the introductions", () => {
		const blocks = [...tab.querySelectorAll(
			".stonetop-playbook-columns, .stonetop-playbook-lore, .stonetop-introductions-section")];
		expect(blocks.map(el => el.className)).toEqual([
			"stonetop-playbook-columns", "stonetop-playbook-lore",
			"stonetop-playbook-columns", "stonetop-introductions-section",
		]);
		const lore = tab.querySelector(".stonetop-playbook-lore");
		expect(lore.firstElementChild.className).toBe("stonetop-panel-divider");
		expect(lore.querySelector(`.stonetop-choice-section [data-cg-context="lore"]`)).not.toBeNull();
	});
});
