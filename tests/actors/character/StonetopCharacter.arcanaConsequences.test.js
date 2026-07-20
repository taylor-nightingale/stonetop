import {describe, it, expect, afterEach, vi} from "vitest";
import { ChoiceTarget } from "../../../src/actors/character/ChoiceTarget.js";
import {StonetopCharacter} from "../../../src/actors/character/StonetopCharacter.js";
import {FoundryRepositoryFactory} from "../../../src/actors/character/repositories/FoundryRepositoryFactory.js";
import {FakeGameBuilder} from "../../fakes/FakeGameBuilder.js";
import {FakeCharacterActorBuilder} from "../../fakes/FakeCharacterActorBuilder.js";
import {FakePackBuilder} from "../../fakes/foundry/FakePackBuilder.js";

// Integration test: real StonetopCharacter + real FoundryRepositoryFactory + real CharacterArcana +
// real ChoiceGroupFactory/Controller. Only the Foundry boundary is faked. This drives the exact wiring
// a sheet click takes for a consequence checkbox — setArcanumChoiceCount(arcanumSlug, groupSlug,
// optionSlug, count) → the generic choiceValues controller → persisted on the arcanum item → read back
// on the next snapshot. Locks bug #50 ("checking the consequences on major arcanum doesn't persist").

function consequenceArcanumItem() {
	return {
		_id: "arc1", type: "arcanum", name: "Blood-quenched Sword", major: true,
		system: {
			slug: "blood-quenched-sword", major: true, flipped: true,
			front: { title: "Blood-quenched Sword", description: null, item: null, unlock: null },
			back: {
				title: "The curse", description: "the back", choices: null,
				consequences: {
					slug: "consequences",
					list: [
						{ type: "entry", slug: "sword-c1", content: { title: null, text: "blood-rage" }, track: { max: 3 } },
						{ type: "entry", slug: "sword-c2", content: { title: null, text: "paranoia" }, track: { max: 1 } },
					],
				},
			},
			choiceValues: {},
		},
	};
}

function characterWithConsequenceArcanum() {
	new FakeGameBuilder().withPack(FakePackBuilder.movesPack()).build();
	const arcanum = consequenceArcanumItem();
	const character = new StonetopCharacter(
		new FakeCharacterActorBuilder().addItem(arcanum).build(), new FoundryRepositoryFactory(),
	);
	return { character, arcanum };
}

async function consequenceChecks(character, optionSlug) {
	const snap = await character.buildSnapshot();
	const card = snap.arcana.major.items.find(a => a.slug === "blood-quenched-sword");
	const row  = card.back.consequences.list.find(r => r.slug === optionSlug);
	return row.track.checks;
}

describe("StonetopCharacter — arcanum consequence checkboxes (integration)", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("a freshly dropped arcanum has all consequences unchecked", async () => {
		const { character } = characterWithConsequenceArcanum();
		expect(await consequenceChecks(character, "sword-c1")).toEqual([false, false, false]);
	});

	it("checking a consequence box persists across a rebuild", async () => {
		const { character } = characterWithConsequenceArcanum();

		await character.setChoiceCountFor(new ChoiceTarget({ context: "arcana", arcanumSlug: "blood-quenched-sword", group: "consequences", option: "sword-c1" }), 2);

		expect(await consequenceChecks(character, "sword-c1")).toEqual([true, true, false]);
	});

	it("unchecking a consequence box clears it", async () => {
		const { character } = characterWithConsequenceArcanum();
		await character.setChoiceCountFor(new ChoiceTarget({ context: "arcana", arcanumSlug: "blood-quenched-sword", group: "consequences", option: "sword-c2" }), 1);
		expect(await consequenceChecks(character, "sword-c2")).toEqual([true]);

		await character.setChoiceCountFor(new ChoiceTarget({ context: "arcana", arcanumSlug: "blood-quenched-sword", group: "consequences", option: "sword-c2" }), 0);

		expect(await consequenceChecks(character, "sword-c2")).toEqual([false]);
	});

	it("consequence values are independent per option", async () => {
		const { character } = characterWithConsequenceArcanum();
		await character.setChoiceCountFor(new ChoiceTarget({ context: "arcana", arcanumSlug: "blood-quenched-sword", group: "consequences", option: "sword-c1" }), 3);
		expect(await consequenceChecks(character, "sword-c1")).toEqual([true, true, true]);
		expect(await consequenceChecks(character, "sword-c2")).toEqual([false]);
	});
});
