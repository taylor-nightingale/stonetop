import {describe, it, expect, afterEach, vi} from "vitest";
import {StonetopCharacter} from "../../../src/actors/character/StonetopCharacter.js";
import {FoundryRepositoryFactory} from "../../../src/actors/character/repositories/FoundryRepositoryFactory.js";
import {FakeGameBuilder} from "../../fakes/FakeGameBuilder.js";
import {FakeCharacterActorBuilder} from "../../fakes/FakeCharacterActorBuilder.js";
import {FakePackBuilder} from "../../fakes/foundry/FakePackBuilder.js";

// Integration test: real StonetopCharacter + real FoundryRepositoryFactory/repositories + real
// CharacterArcana/CharacterInventory. Only the Foundry boundary is faked. This exercises the full
// drop→onArcanumCreated→ContainerOutfitSync→inventory-snapshot wiring, which is exactly where the
// bug lived: the arcanum CARD showed tags (its own builder), but the embedded inventory item didn't
// carry them, so the inventory-tab row showed only the name. A unit test on either side would miss it.

function withEmptyMovesPack() {
	new FakeGameBuilder().withPack(FakePackBuilder.movesPack()).build();
}

// A dropped arcanum whose FRONT item carries split tags + a plain note and lives in the inventory
// (inventoryColumn set → it syncs an embedded outfit item). flipped:false → the front item is used.
function arcanumWithFrontItem() {
	return {
		_id: "arc1", type: "arcanum", name: "Azure Hand",
		system: {
			slug: "azure-hand", major: true, flipped: false,
			front: {
				title: "Azure Hand", description: null, unlock: null,
				item: { name: "Azure Hand", weight: 1, tagList: { selected: ["close", "magical", "awkward"], options: [], multi: true, allowCustom: true }, note: null, inventoryColumn: "regular" },
			},
			back: { title: "Mysteries", description: "the back", moveSlugs: [] },
			choiceValues: {},
		},
	};
}

function characterWithArcanum(arcanumItem) {
	return new StonetopCharacter(
		new FakeCharacterActorBuilder().addItem(arcanumItem).build(), new FoundryRepositoryFactory(),
	);
}

// Find the arcanum's synced item in the inventory snapshot (embedded items trail as a null-named section).
async function inventoryItem(character, slug) {
	const snap = await character.buildSnapshot();
	return snap.outfit.regularSections.flatMap(s => s.items).find(i => i.slug === slug);
}

describe("StonetopCharacter — arcanum inventory item carries tags + note (integration)", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("syncs the arcanum's front-item tags AND note onto the inventory-tab row", async () => {
		withEmptyMovesPack();
		const arcanum = arcanumWithFrontItem();
		const character = characterWithArcanum(arcanum);

		await character._onCreateDescendantDocuments([arcanum]);

		const item = await inventoryItem(character, "azure-hand");
		expect(item).toBeDefined();
		expect(item.name).toBe("Azure Hand");
		expect(item.tags.map((t) => t.label)).toEqual(["close", "magical", "awkward"]); // the bug: this was empty
		expect(item.note.raw).toBe("");                         // null note → empty RichText
	});

	it("syncs a plain-text note too (split item with both tags and note)", async () => {
		withEmptyMovesPack();
		const arcanum = arcanumWithFrontItem();
		arcanum.system.front.item = {
			name: "Blood-quenched Sword", weight: 1,
			tagList: { selected: ["close", "messy", "magical"], options: [], multi: true, allowCustom: true }, note: "+1 damage, 1 piercing", inventoryColumn: "regular",
		};
		const character = characterWithArcanum(arcanum);

		await character._onCreateDescendantDocuments([arcanum]);

		const item = await inventoryItem(character, "azure-hand");
		expect(item.tags.map((t) => t.label)).toEqual(["close", "messy", "magical"]);
		expect(item.note.raw).toBe("+1 damage, 1 piercing");
	});
});
