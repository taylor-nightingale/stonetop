import { describe, expect, it, vi } from "vitest";
import { TestCharacterBuilder } from "../../fakes/TestCharacterBuilder.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { ChoiceTarget } from "../../../src/actors/character/ChoiceTarget.js";

function makeChar() {
	return new TestCharacterBuilder(new FakeCharacterActorBuilder().build()).build();
}

describe("StonetopCharacter.setChoiceCountFor", () => {
	it("routes a possession target to setPossessionChoiceValue with the option only", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setPossessionChoiceValue").mockResolvedValue();
		await char.setChoiceCountFor(new ChoiceTarget({ possessionSlug: "charm", group: "g", option: "o" }), 2);
		expect(spy).toHaveBeenCalledWith("charm", "o", 2);
	});

	it("routes an insert target to setInsertChoiceCount", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setInsertChoiceCount").mockResolvedValue();
		await char.setChoiceCountFor(new ChoiceTarget({ insertItemId: "item9", group: "g", option: "o" }), 1);
		expect(spy).toHaveBeenCalledWith("item9", "g", "o", 1);
	});

	it("routes an arcanum target to setArcanumChoiceCount", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setArcanumChoiceCount").mockResolvedValue();
		await char.setChoiceCountFor(new ChoiceTarget({ arcanumSlug: "eye", group: "g", option: "o" }), 3);
		expect(spy).toHaveBeenCalledWith("eye", "g", "o", 3);
	});

	it("falls back to the plain context route", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setChoiceCount").mockResolvedValue();
		await char.setChoiceCountFor(new ChoiceTarget({ context: "background", group: "g", option: "o" }), 1);
		expect(spy).toHaveBeenCalledWith("background", "g", "o", 1);
	});

	it("prefers the possession container over insert and arcanum", async () => {
		const char = makeChar();
		const possession = vi.spyOn(char, "setPossessionChoiceValue").mockResolvedValue();
		const insert = vi.spyOn(char, "setInsertChoiceCount").mockResolvedValue();
		await char.setChoiceCountFor(
			new ChoiceTarget({ possessionSlug: "charm", insertItemId: "item9", arcanumSlug: "eye", option: "o" }), 1);
		expect(possession).toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
	});
});

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
		const spy = vi.spyOn(char, "setChoicePick").mockResolvedValue();
		await char.setChoicePickFor(new ChoiceTarget({ group: "g", option: "o" }), true);
		expect(spy).not.toHaveBeenCalled();
	});

	it("routes an insert target to setInsertChoicePick with the siblings csv", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setInsertChoicePick").mockResolvedValue();
		await char.setChoicePickFor(
			new ChoiceTarget({ context: "instinct", insertItemId: "item9", group: "g", option: "o", siblingsCsv: "a,b" }), true);
		expect(spy).toHaveBeenCalledWith("item9", "g", "o", "a,b");
	});

	it("routes an arcanum target to selectArcanumChoice", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "selectArcanumChoice").mockResolvedValue();
		await char.setChoicePickFor(
			new ChoiceTarget({ context: "arcana", arcanumSlug: "eye", group: "g", option: "o", siblingsCsv: null }), true);
		expect(spy).toHaveBeenCalledWith("eye", "g", "o", null);
	});

	it("falls back to the plain context route, passing checked through", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setChoicePick").mockResolvedValue();
		await char.setChoicePickFor(
			new ChoiceTarget({ context: "background", group: "g", option: "o", siblingsCsv: "a" }), false);
		expect(spy).toHaveBeenCalledWith("background", "g", "o", "a", false);
	});
});

describe("StonetopCharacter.setChoiceTextFor", () => {
	it("routes a possession target even without a context", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setPossessionChoiceValue").mockResolvedValue();
		await char.setChoiceTextFor(new ChoiceTarget({ possessionSlug: "charm", option: "o" }), "txt");
		expect(spy).toHaveBeenCalledWith("charm", "o", "txt");
	});

	it("does nothing without a context outside a possession", async () => {
		const char = makeChar();
		const insert = vi.spyOn(char, "setInsertChoiceText").mockResolvedValue();
		const plain = vi.spyOn(char, "setChoiceText").mockResolvedValue();
		await char.setChoiceTextFor(new ChoiceTarget({ insertItemId: "item9", group: "g", option: "o" }), "txt");
		expect(insert).not.toHaveBeenCalled();
		expect(plain).not.toHaveBeenCalled();
	});

	it("routes an insert target to setInsertChoiceText", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setInsertChoiceText").mockResolvedValue();
		await char.setChoiceTextFor(
			new ChoiceTarget({ context: "insert", insertItemId: "item9", group: "g", option: "o" }), "txt");
		expect(spy).toHaveBeenCalledWith("item9", "g", "o", "txt");
	});

	it("routes an arcanum target to setArcanumChoiceText", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setArcanumChoiceText").mockResolvedValue();
		await char.setChoiceTextFor(
			new ChoiceTarget({ context: "arcana", arcanumSlug: "eye", group: "g", option: "o" }), "txt");
		expect(spy).toHaveBeenCalledWith("eye", "g", "o", "txt");
	});

	it("falls back to the plain context route", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setChoiceText").mockResolvedValue();
		await char.setChoiceTextFor(new ChoiceTarget({ context: "move", group: "g", option: "o" }), "txt");
		expect(spy).toHaveBeenCalledWith("move", "g", "o", "txt");
	});
});
