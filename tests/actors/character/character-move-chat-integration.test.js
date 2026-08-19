// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";

// End-to-end for the per-move chat button: the sheet's moveToChat action drives the REAL
// StonetopCharacter → CharacterMoves/CharacterArcana routing down to the actor's chat surface
// (FakeActor records what would be posted; the posting itself is covered by StonetopActor.chat.test).

function makeWiredSheet(items) {
	new FakeGameBuilder().build();
	const actor = new FakeCharacterActorBuilder()
		.withItems(items)
		.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory()))
		.build();
	const Base = class {
		get actor() { return actor; }
		get typedActor() { return actor.typedActor; }
		get isEditable() { return true; }
		element = document.createElement("form");
	};
	const sheet = new (createStonetopCharacterSheetClass(Base))();
	return { actor, sheet };
}

// Invoke the data-action handler the way core does: handler.call(app, event, target).
function clickChat(sheet, moveSlug) {
	const btn = document.createElement("a");
	btn.dataset.moveSlug = moveSlug;
	return sheet.constructor.DEFAULT_OPTIONS.actions.moveToChat.call(sheet, { type: "click" }, btn);
}

describe("character sheet moveToChat (integration)", () => {
	it("an owned move row's button routes its item to the actor's chat surface", async () => {
		const move = { _id: "m1", type: "move", name: "Defend", system: { slug: "defend", categoryKey: "basic" } };
		const { actor, sheet } = makeWiredSheet([move]);
		await clickChat(sheet, "defend");
		expect(actor.chatItems).toHaveLength(1);
		expect(actor.chatItems[0]._id).toBe("m1");
		expect(actor.chatDescriptions).toHaveLength(0);
	});

	it("an inline arcanum mystery move's button falls back to the arcana text", async () => {
		const arcanum = { _id: "a1", type: "arcanum", name: "Ring", system: {
			slug: "silvery-ring", front: {}, back: { moves: [
				{ id: "move-abc12345", name: "Whispered Command", text: "Will someone to obey." },
			] },
		} };
		const { actor, sheet } = makeWiredSheet([arcanum]);
		await clickChat(sheet, "move-abc12345");
		expect(actor.chatItems).toHaveLength(0);
		expect(actor.chatDescriptions).toEqual([
			{ label: "Whispered Command", description: "Will someone to obey." },
		]);
	});
});
