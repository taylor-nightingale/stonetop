import { describe, it, expect } from "vitest";
import { CharacterArcana } from "../../../src/actors/character/CharacterArcana.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeArcanaRepository } from "../../fakes/FakeArcanaRepository.js";

// Deleting the card is what makes Foundry fire the delete-descendant hook, and that hook revokes the
// card's source too — un-awaited, so it races whatever comes after the delete. While the grants were
// taken back AFTER the card, both paths could compute the same granted move items and both issue the
// delete: the loser threw `Item "…" does not exist!`. Taking the grants back FIRST leaves the hook
// nothing to find.

const CARD_ID = "card1";
const MOVE_ID = "mov1";

function actorWithGrantedCard() {
	const card = {
		_id: CARD_ID, type: "arcanum", name: "Red Scepter",
		system: { slug: "red-scepter", major: true, front: {}, back: {}, flipped: false, choiceValues: {} },
	};
	const grantedMove = {
		_id: MOVE_ID, type: "move", name: "Burning Hatred",
		flags: { stonetop: { grant: { source: "arcana:red-scepter", key: "move:burning-hatred" } } },
		system: { slug: "burning-hatred", categoryKey: "arcana-red-scepter" },
	};
	const actor = new FakeCharacterActorBuilder().withItems([card, grantedMove]).build();

	const deletions = [];
	const realDelete = actor.deleteEmbeddedDocuments.bind(actor);
	actor.deleteEmbeddedDocuments = async (type, ids) => {
		deletions.push(...ids);
		return realDelete(type, ids);
	};
	return { actor, deletions };
}

describe("CharacterArcana.removeArcanum — deletion order", () => {
	it("takes the card's grants back before deleting the card itself", async () => {
		const { actor, deletions } = actorWithGrantedCard();
		const arcana = new CharacterArcana(actor, new FakeArcanaRepository());

		await arcana.removeArcanum("red-scepter");

		expect(deletions).toContain(MOVE_ID);
		expect(deletions.indexOf(MOVE_ID)).toBeLessThan(deletions.indexOf(CARD_ID));
	});

	it("still removes the card and everything it granted", async () => {
		const { actor } = actorWithGrantedCard();
		const arcana = new CharacterArcana(actor, new FakeArcanaRepository());

		await arcana.removeArcanum("red-scepter");

		expect([...actor.items].map(i => i._id)).toEqual([]);
	});

	it("deletes each item once, so a second revoke of the same source has nothing to repeat", async () => {
		const { actor, deletions } = actorWithGrantedCard();
		const arcana = new CharacterArcana(actor, new FakeArcanaRepository());

		await arcana.removeArcanum("red-scepter");

		expect(new Set(deletions).size).toBe(deletions.length);
	});
});
