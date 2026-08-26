import { describe, it, expect } from "vitest";
import { TestCharacterBuilder } from "../../fakes/TestCharacterBuilder.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { ChoiceTarget } from "../../../src/actors/character/ChoiceTarget.js";

// Integration test: real StonetopCharacter + real CharacterBackgrounds/CharacterArcana, only the
// Foundry boundary faked. The Seeker's backgrounds each offer three major arcana as marked rows; the
// mark is what makes the character own the card. This drives the whole road a click takes — background
// choice store → published change → arcanum handler → an embedded card on the Arcana tab.

function seekerPlaybookItem() {
	const row = (slug, text) => ({
		slug, track: { max: 1 }, type: "entry", content: { title: null, text },
		grants: [{ type: "arcanum", slug, locations: ["tab"] }],
	});
	return {
		_id: "pb1", type: "playbook", name: "The Seeker",
		system: {
			slug: "the-seeker", backgroundValues: {},
			backgrounds: [{
				slug: "patriot", label: "Patriot",
				choices: { slug: "patriot", list: [
					row("red-scepter", "The Red Scepter"),
					row("staff-of-the-lidless-orb", "The Staff of the Lidless Orb"),
				] },
			}],
		},
	};
}

function arcanumDef(slug, name) {
	return { slug, name, major: true, img: null, front: { item: null, choices: [] }, back: { choices: [] } };
}

function characterWithSeeker() {
	const actor = new FakeCharacterActorBuilder().withItems([seekerPlaybookItem()]).build();
	const char  = new TestCharacterBuilder(actor)
		.addArcanum(arcanumDef("red-scepter", "Red Scepter"))
		.addArcanum(arcanumDef("staff-of-the-lidless-orb", "Staff of the Lidless Orb"))
		.build();
	return { char, actor };
}

const patriotRow = option => new ChoiceTarget({ context: "background", group: "patriot", option });

const ownedArcana = actor => [...actor.items].filter(i => i.type === "arcanum").map(i => i.system.slug);

describe("StonetopCharacter — a background choice row grants its arcanum (integration)", () => {
	it("marking the row embeds the arcanum it grants", async () => {
		const { char, actor } = characterWithSeeker();

		await char.setChoiceTrackFor(patriotRow("red-scepter"), 0, true);

		expect(ownedArcana(actor)).toEqual(["red-scepter"]);
		expect([...actor.items].find(i => i.type === "arcanum").name).toBe("Red Scepter");
	});

	it("the marked card lands on the Arcana tab as a major arcanum", async () => {
		const { char } = characterWithSeeker();
		await char.setChoiceTrackFor(patriotRow("red-scepter"), 0, true);

		const snapshot = await char.buildSnapshot();

		expect(snapshot.arcana.major.items.map(c => c.slug)).toEqual(["red-scepter"]);
	});

	it("un-marking the row hands the card back", async () => {
		const { char, actor } = characterWithSeeker();
		await char.setChoiceTrackFor(patriotRow("red-scepter"), 0, true);

		await char.setChoiceTrackFor(patriotRow("red-scepter"), 0, false);

		expect(ownedArcana(actor)).toEqual([]);
	});

	// The rows are independent checkboxes, not an exclusive pick: the sheet guides ("1 major arcanum")
	// but never blocks a table that wants to hand out two.
	it("each row grants only its own arcanum", async () => {
		const { char, actor } = characterWithSeeker();

		await char.setChoiceTrackFor(patriotRow("red-scepter"), 0, true);
		await char.setChoiceTrackFor(patriotRow("staff-of-the-lidless-orb"), 0, true);

		expect(ownedArcana(actor).sort()).toEqual(["red-scepter", "staff-of-the-lidless-orb"]);

		await char.setChoiceTrackFor(patriotRow("red-scepter"), 0, false);

		expect(ownedArcana(actor)).toEqual(["staff-of-the-lidless-orb"]);
	});

	it("records the mark on the playbook's background value store", async () => {
		const { char, actor } = characterWithSeeker();

		await char.setChoiceTrackFor(patriotRow("red-scepter"), 0, true);

		expect(actor.items.get("pb1").system.backgroundValues.patriot["red-scepter"]).toBe(1);
	});
});
