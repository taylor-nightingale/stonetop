import { describe, expect, it, vi } from "vitest";
import { TestCharacterBuilder } from "../../fakes/TestCharacterBuilder.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { ChoiceTarget } from "../../../src/actors/character/ChoiceTarget.js";

// Where a choice write LANDS is covered end-to-end in StonetopCharacter.choiceStores.test.js. What is
// left here is the arithmetic and guards the router owns itself.

function makeChar() {
	return new TestCharacterBuilder(new FakeCharacterActorBuilder().build()).build();
}

describe("StonetopCharacter.setChoiceTrackFor", () => {
	it("checking box index fills through index+1 (numeric from dataset string)", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setChoiceCountFor").mockResolvedValue();
		const target = new ChoiceTarget({ context: "move", group: "g", option: "o" });
		await char.setChoiceTrackFor(target, "2", true);
		expect(spy).toHaveBeenCalledWith(target, 3);
	});

	it("unchecking box index empties back to index", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setChoiceCountFor").mockResolvedValue();
		const target = new ChoiceTarget({ context: "move", group: "g", option: "o" });
		await char.setChoiceTrackFor(target, "2", false);
		expect(spy).toHaveBeenCalledWith(target, 2);
	});
});

describe("StonetopCharacter.setChoicePickFor", () => {
	it("does nothing without a context", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char._choiceStores, "resolve");
		await char.setChoicePickFor(new ChoiceTarget({ group: "g", option: "o" }), true);
		expect(spy).not.toHaveBeenCalled();
	});
});
