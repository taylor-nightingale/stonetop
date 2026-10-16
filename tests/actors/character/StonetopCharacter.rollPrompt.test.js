import { describe, expect, it } from "vitest";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { RollRule } from "../../../src/actors/RollPrompt.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";

// What a character's roll dialog shows beside the modes (ActorRolling#execute).

const advantageMove = (name = "Advantage/Disadvantage") =>
	({ _id: "adv-1", type: "move", name, system: { slug: "advantage-disadvantage", moveType: "special" } });

const makeCharacter = ({ items = [], moves = new FakeMoveRepository() } = {}) =>
	new StonetopCharacter(new FakeCharacterActorBuilder().withItems(items).build(), new FakeRepositoryFactory({ moves }));

describe("StonetopCharacter.rollModeRule", () => {
	it("links the character's own copy of the Advantage/Disadvantage move", async () => {
		const rule = await makeCharacter({ items: [advantageMove("Mine")] }).rollModeRule();
		expect(rule).toEqual(new RollRule("advantage-disadvantage", "Mine"));
	});

	it("falls back to the pack's when the character has none", async () => {
		const rule = await makeCharacter({ moves: new FakeMoveRepository([], [advantageMove()]) }).rollModeRule();
		expect(rule).toEqual(new RollRule("advantage-disadvantage", "Advantage/Disadvantage"));
	});

	it("links nothing when the move is nowhere to be found", async () => {
		expect(await makeCharacter().rollModeRule()).toBeNull();
	});
});

// The reminders are the steading's: what its improvements entitle it to. A character's own moves
// carry none.
describe("StonetopCharacter.rollNotesFor", () => {
	it("has none", async () => {
		expect(await makeCharacter().rollNotesFor("defy-danger")).toBeNull();
	});
});
