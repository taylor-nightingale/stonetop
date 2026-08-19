// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { stonetopActorSheetBase } from "../../fakes/foundry/stonetopActorSheetBase.js";

// Characterization net for the deferred "arcanum blanks onto the snapshot" change.
//
// The sheet seeds every card's blanks after each render. It reads them ONCE per render
// (_onRender → getAllArcanumBlanks → CharacterArcana.allBlanks → one OwnedArcanum.all pass); it used
// to ask per card, rescanning the whole embedded-item collection each time. What the player sees is
// asserted here through the real StonetopCharacter → CharacterArcana → OwnedArcanum chain rather
// than a mocked reader, so the net survives changes to how the blanks are fetched.

function arcanumItem(slug, blanks = {}) {
	return {
		_id: `${slug}-item`, type: "arcanum", name: "Azure Hand",
		system: {
			slug, major: true, flipped: false,
			front: { description: "the front", item: null, unlock: null },
			back:  { title: "Mysteries", description: "the back", choices: [] },
			choiceValues: { blanks },
		},
	};
}

function sheetWith(...items) {
	new FakeGameBuilder().build();
	const actor = new FakeCharacterActorBuilder()
		.withItems(items)
		.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory()))
		.build();
	const sheet = new (createStonetopCharacterSheetClass(stonetopActorSheetBase()))(actor);
	return { sheet, actor, character: actor.typedActor };
}

// The markup the arcanum card partial emits for a write-in blank (the @Blank enricher renders the
// input empty, which is why the sheet seeds it after every render).
function renderCard(sheet, slug, ...blankKeys) {
	sheet.element.innerHTML = `
		<div class="stonetop-arcanum-card" data-slug="${slug}">
			${blankKeys.map(k => `<input class="stonetop-arcanum-blank" data-blank-key="${k}">`).join("")}
		</div>`;
	sheet._onRender({}, {});
	return [...sheet.element.querySelectorAll("input.stonetop-arcanum-blank")];
}

beforeEach(() => { document.body.innerHTML = ""; });

describe("arcanum write-in blanks (integration)", () => {
	it("seeds a blank from what the character actually stored", async () => {
		const { sheet, character } = sheetWith(arcanumItem("azure-hand"));

		await character.setArcanumBlank("azure-hand", "storm-die", "d8");
		const [input] = renderCard(sheet, "azure-hand", "storm-die");

		expect(input.value).toBe("d8");
	});

	it("leaves a blank the character has no value for empty", () => {
		const { sheet } = sheetWith(arcanumItem("azure-hand", { "storm-die": "d8" }));

		const [seeded, unset] = renderCard(sheet, "azure-hand", "storm-die", "never-written");

		expect(seeded.value).toBe("d8");
		expect(unset.value).toBe("");
	});

	// The part content is replaced wholesale, so the seeding has to survive a re-render.
	it("re-seeds after a render that replaced the card", async () => {
		const { sheet, character } = sheetWith(arcanumItem("azure-hand"));
		await character.setArcanumBlank("azure-hand", "storm-die", "d8");

		renderCard(sheet, "azure-hand", "storm-die");
		const [afterRerender] = renderCard(sheet, "azure-hand", "storm-die"); // fresh, empty markup

		expect(afterRerender.value).toBe("d8");
	});

	it("reflects a value the player just changed", async () => {
		const { sheet, character } = sheetWith(arcanumItem("azure-hand", { "storm-die": "d8" }));

		await character.setArcanumBlank("azure-hand", "storm-die", "d10");
		const [input] = renderCard(sheet, "azure-hand", "storm-die");

		expect(input.value).toBe("d10");
	});

	// Each card reads its OWN blanks — the lookup is by the card's slug, which is the part the
	// snapshot change has to preserve when the per-card actor scan goes away.
	it("keeps two cards' blanks apart", async () => {
		const { sheet, character } = sheetWith(
			arcanumItem("azure-hand", { key: "hand" }),
			arcanumItem("mindgem", { key: "gem" }),
		);

		sheet.element.innerHTML = `
			<div class="stonetop-arcanum-card" data-slug="azure-hand">
				<input class="stonetop-arcanum-blank" data-blank-key="key"></div>
			<div class="stonetop-arcanum-card" data-slug="mindgem">
				<input class="stonetop-arcanum-blank" data-blank-key="key"></div>`;
		sheet._onRender({}, {});

		const [hand, gem] = sheet.element.querySelectorAll("input");
		expect(hand.value).toBe("hand");
		expect(gem.value).toBe("gem");
	});

	it("leaves a card whose arcanum the character does not own empty", () => {
		const { sheet } = sheetWith(arcanumItem("azure-hand", { key: "hand" }));

		const [input] = renderCard(sheet, "not-owned", "key");

		expect(input.value).toBe("");
	});
});
