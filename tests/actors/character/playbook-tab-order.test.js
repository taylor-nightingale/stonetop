// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from "vitest";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { TestPlaybookItemBuilder } from "../../fakes/TestPlaybookItemBuilder.js";
import { renderPartial } from "../../fakes/renderTemplate.js";

// The playbook tab is filled in top to bottom: the fixed sections a character picks first
// (background, instinct, appearance, origin) share the two fixed columns, and the playbook's own
// story and the introductions run across both beneath them. Order here is the reading order of the
// sheet, and nothing else asserts it.

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
			tabs: {}, actor, editable: true, viewFlags: {}, sheetIdPrefix: "s1",
			stonetop: await actor.typedActor.buildSnapshot(),
		});
	});

	const keys = root => [...root.querySelectorAll("[data-section]")].map(el => el.dataset.section);

	// The columns hold what a character picks, in the order the playbook asks for it.
	it("puts background, instinct, appearance and origin in the two columns, in that order", () => {
		expect(keys(tab.querySelector(".stonetop-section-columns"))).toEqual(["background", "instinct", "appearance", "origin"]);
	});

	// The playbook's own story, then the introductions, run across both columns beneath them.
	it("sets the lore and then the introductions below the columns", () => {
		expect(keys(tab)).toEqual(["background", "instinct", "appearance", "origin", "lore-tall-tales", "introductions"]);
		const lore = tab.querySelector('[data-section="lore-tall-tales"]');
		expect(lore.closest(".stonetop-section-columns")).toBeNull();
	});
});
