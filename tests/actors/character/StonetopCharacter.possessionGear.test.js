import { describe, it, expect, afterEach, vi } from "vitest";
import { ChoiceTarget } from "../../../src/actors/character/ChoiceTarget.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FoundryRepositoryFactory } from "../../../src/actors/character/repositories/FoundryRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakePackBuilder } from "../../fakes/foundry/FakePackBuilder.js";

// Integration test: real StonetopCharacter + real CharacterPossessions + real ChoiceGroupFactory /
// ChoiceGroupController + real ContainerOutfitSync + real ActorOutfitItems + real
// CharacterInventory. Only the Foundry boundary (game.packs, embedded documents) is faked.
//
// This pins down what actually reaches the inventory when a possession's pick is ticked, so the
// question of whether possessions should fire the shared outfit-item side effect can be answered by
// running the code rather than by reading it.

// A weapons-of-war-shaped possession: base gear on the possession itself, plus a pick row whose
// options each grant their own outfit item.
function weaponsOfWarItem() {
	return {
		_id: "poss1", type: "possession", name: "Weapons of war",
		system: {
			slug: "weapons-of-war-heavy",
			selected: true,
			playbookSlug: "the-heavy",
			outfitItems: [
				{ slug: "shield", name: "Shield", weight: 2, inventoryColumn: "regular", note: null },
			],
			choices: {
				slug: "weapons-of-war-heavy",
				list: [
					{
						type: "pick", pickCount: 3,
						options: [
							{ slug: "sword", text: "Sword, iron", outfitItems: [
								{ slug: "sword", name: "Sword, iron", weight: 1, inventoryColumn: "regular", note: "+1 damage" },
							]},
							{ slug: "long-spear", text: "Long spear", outfitItems: [
								{ slug: "long-spear", name: "Long spear", weight: 2, inventoryColumn: "regular", note: "reach" },
							]},
						],
					},
				],
			},
			pickValues: {},
			choiceUses: {},
		},
	};
}

function makeCharacter() {
	new FakeGameBuilder()
		.withPack(new FakePackBuilder("outfit-items"))
		.withPack(new FakePackBuilder("possessions"))
		.withPack(FakePackBuilder.movesPack())
		.withPack(FakePackBuilder.playbooksPack())
		.build();
	const actor = new FakeCharacterActorBuilder().addItem(weaponsOfWarItem()).build();
	return { character: new StonetopCharacter(actor, new FoundryRepositoryFactory()), actor };
}

/** Every outfit item document embedded on the actor, as `slug @ source` (what granting produced). */
function embeddedGear(actor) {
	return [...actor.items]
		.filter(i => i.type === "outfitItem")
		.map(i => `${i.system?.slug} @ ${i.flags?.stonetop?.grant?.source ?? "custom"}`)
		.sort();
}

/** Names the equipment tab would actually render, in order, including duplicates. */
async function renderedGearNames(character) {
	const snap = await character.buildSnapshot();
	return snap.outfit.regularSections.flatMap(s => s.runs.flatMap(r => r.items.map(i => i.name)));
}

describe("possession pick → inventory (integration)", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("ticking a pick grants exactly one document, under the container's single source", async () => {
		const { character, actor } = makeCharacter();

		await character.setChoiceCountFor(new ChoiceTarget({ context: "possession", possessionSlug: "weapons-of-war-heavy", group: "weapons-of-war-heavy", option: "sword" }), 1);

		expect(embeddedGear(actor)).toEqual([
			"shield @ outfit:possession:weapons-of-war-heavy",
			"sword @ outfit:possession:weapons-of-war-heavy",
		]);
	});

	// The side-effect definition lookup keys on the namespace, which is the possession's own slug, so a
	// group whose slug differs grants NOTHING. Shipped data used to author "weapons-of-war" on both
	// weapons-of-war possessions; the pack files now match their possession slug and
	// tests/pack/choice-group-structure.test.js guards it. Existing worlds need the migration.
	it("grants nothing when the authored choices.slug does not match the namespace", async () => {
		new FakeGameBuilder()
			.withPack(new FakePackBuilder("outfit-items")).withPack(new FakePackBuilder("possessions"))
			.withPack(FakePackBuilder.movesPack()).withPack(FakePackBuilder.playbooksPack()).build();
		const item = weaponsOfWarItem();
		item.system.choices.slug = "weapons-of-war";   // as shipped
		const actor = new FakeCharacterActorBuilder().addItem(item).build();
		const character = new StonetopCharacter(actor, new FoundryRepositoryFactory());

		await character.setChoiceCountFor(new ChoiceTarget({ context: "possession", possessionSlug: "weapons-of-war-heavy", group: "weapons-of-war-heavy", option: "sword" }), 1);

		expect(embeddedGear(actor)).not.toContain("sword @ outfit:possession:weapons-of-war-heavy");
	});

	it("the write path syncs the container — the host does not have to ask", async () => {
		const { character, actor } = makeCharacter();

		// setPossessionChoiceValue writes through the shared controller; nothing here calls a sync.
		await character.setChoiceCountFor(new ChoiceTarget({ context: "possession", possessionSlug: "weapons-of-war-heavy", group: "weapons-of-war-heavy", option: "sword" }), 1);
		await character.setChoiceCountFor(new ChoiceTarget({ context: "possession", possessionSlug: "weapons-of-war-heavy", group: "weapons-of-war-heavy", option: "long-spear" }), 1);

		expect(embeddedGear(actor).filter(g => g.startsWith("sword"))).toHaveLength(1);
	});

	it("the granted gear renders once on the equipment tab", async () => {
		const { character } = makeCharacter();

		await character.setChoiceCountFor(new ChoiceTarget({ context: "possession", possessionSlug: "weapons-of-war-heavy", group: "weapons-of-war-heavy", option: "sword" }), 1);

		const names = await renderedGearNames(character);
		expect(names.filter(n => n === "Sword, iron")).toHaveLength(1);
	});

	it("unticking the pick removes the gear but leaves the possession's base gear", async () => {
		const { character, actor } = makeCharacter();
		await character.setChoiceCountFor(new ChoiceTarget({ context: "possession", possessionSlug: "weapons-of-war-heavy", group: "weapons-of-war-heavy", option: "sword" }), 1);

		await character.setChoiceCountFor(new ChoiceTarget({ context: "possession", possessionSlug: "weapons-of-war-heavy", group: "weapons-of-war-heavy", option: "sword" }), 0);

		expect(embeddedGear(actor)).toEqual(["shield @ outfit:possession:weapons-of-war-heavy"]);
	});

	it("deselecting the possession removes every item it granted", async () => {
		const { character, actor } = makeCharacter();
		await character.setChoiceCountFor(new ChoiceTarget({ context: "possession", possessionSlug: "weapons-of-war-heavy", group: "weapons-of-war-heavy", option: "sword" }), 1);

		await character.deselectPossession("weapons-of-war-heavy");

		expect(embeddedGear(actor)).toEqual([]);
	});

	it("re-selecting the possession restores the gear from the stored picks", async () => {
		const { character, actor } = makeCharacter();
		await character.setChoiceCountFor(new ChoiceTarget({ context: "possession", possessionSlug: "weapons-of-war-heavy", group: "weapons-of-war-heavy", option: "sword" }), 1);
		await character.deselectPossession("weapons-of-war-heavy");

		await character.selectPossession("weapons-of-war-heavy");

		expect(embeddedGear(actor)).toEqual([
			"shield @ outfit:possession:weapons-of-war-heavy",
			"sword @ outfit:possession:weapons-of-war-heavy",
		]);
	});
});
