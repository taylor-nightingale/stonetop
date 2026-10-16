import { describe, it, expect } from "vitest";
import { TestCharacterBuilder } from "../../fakes/TestCharacterBuilder.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { ChoiceTarget } from "../../../src/actors/character/ChoiceTarget.js";

// Integration test: real StonetopCharacter + real CharacterBackgrounds/CharacterArcana, only the
// Foundry boundary faked. The Seeker's backgrounds each offer three major arcana as a pick of one; the
// pick is what makes the character own the card. This drives the whole road a click takes — background
// choice store → published change → arcanum handler → an embedded card on the Arcana tab.

function seekerPlaybookItem() {
	const option = (slug, text) => ({ slug, text, grants: [{ type: "arcanum", slug, locations: ["tab"] }] });
	return {
		_id: "pb1", type: "playbook", name: "The Seeker",
		system: {
			slug: "the-seeker", backgroundValues: {},
			backgrounds: [{
				slug: "patriot", label: "Patriot",
				choices: { slug: "patriot", list: [{ type: "pick", slug: "major-arcanum", pickCount: 1, options: [
					option("red-scepter", "The Red Scepter"),
					option("staff-of-the-lidless-orb", "The Staff of the Lidless Orb"),
				] }] },
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

const patriotPick = option => new ChoiceTarget({
	context: "background", group: "patriot", option, siblingsCsv: "red-scepter,staff-of-the-lidless-orb",
});

const ownedArcana = actor => [...actor.items].filter(i => i.type === "arcanum").map(i => i.system.slug);

describe("StonetopCharacter — a background's arcanum pick grants its arcanum (integration)", () => {
	it("picking an option embeds the arcanum it grants", async () => {
		const { char, actor } = characterWithSeeker();

		await char.setChoicePickFor(patriotPick("red-scepter"));

		expect(ownedArcana(actor)).toEqual(["red-scepter"]);
		expect([...actor.items].find(i => i.type === "arcanum").name).toBe("Red Scepter");
	});

	it("the marked card lands on the Arcana tab as a major arcanum", async () => {
		const { char } = characterWithSeeker();
		await char.setChoicePickFor(patriotPick("red-scepter"));

		const snapshot = await char.buildSnapshot();

		expect(snapshot.arcana.major.items.map(c => c.slug)).toEqual(["red-scepter"]);
	});

	it("releasing the pick hands the card back", async () => {
		const { char, actor } = characterWithSeeker();
		await char.setChoicePickFor(patriotPick("red-scepter"));

		await char.clearChoicePickFor(patriotPick("red-scepter"));

		expect(ownedArcana(actor)).toEqual([]);
	});

	it("picking another option swaps the card for its own", async () => {
		const { char, actor } = characterWithSeeker();

		await char.setChoicePickFor(patriotPick("red-scepter"));
		await char.setChoicePickFor(patriotPick("staff-of-the-lidless-orb"));

		expect(ownedArcana(actor)).toEqual(["staff-of-the-lidless-orb"]);
		expect(actor.items.get("pb1").system.backgroundValues.patriot).toEqual({
			"red-scepter": 0, "staff-of-the-lidless-orb": 1,
		});
	});

	it("records the pick on the playbook's background value store", async () => {
		const { char, actor } = characterWithSeeker();

		await char.setChoicePickFor(patriotPick("red-scepter"));

		expect(actor.items.get("pb1").system.backgroundValues.patriot["red-scepter"]).toBe(1);
	});
});
