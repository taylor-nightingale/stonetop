import { describe, expect, it, vi } from "vitest";
import {TestCharacterBuilder} from "../../fakes/TestCharacterBuilder.js";
import {FakeActorBuilder} from "../../fakes/FakeActorBuilder.js";

// -- onDropItems --------------------------------------------------------------

describe("StonetopCharacter.onDropItems", () => {
	function makeChar() {
		return new TestCharacterBuilder(new FakeActorBuilder().build()).build();
	}

	it("routes arcanum move to addArcanum and returns anyAdded=true", async () => {
		const char = makeChar();
		const addArcanum = vi.spyOn(char, "addArcanum").mockResolvedValue();
		const item = { type: "equipment", system: { equipmentType: "arcanum", slug: "shell-game" } };

		const { anyAdded, others } = await char.onDropItems([item]);

		expect(addArcanum).toHaveBeenCalledWith("shell-game");
		expect(anyAdded).toBe(true);
		expect(others).toHaveLength(0);
	});

	it("skips arcanum item with no slug and returns anyAdded=false", async () => {
		const char = makeChar();
		const addArcanum = vi.spyOn(char, "addArcanum").mockResolvedValue();
		const item = { type: "equipment", system: { equipmentType: "arcanum" }, flags: {} };

		const { anyAdded } = await char.onDropItems([item]);

		expect(addArcanum).not.toHaveBeenCalled();
		expect(anyAdded).toBe(false);
	});

	it("routes non-arcanum move to onDropMove and returns anyAdded when truthy", async () => {
		const char = makeChar();
		const onDropMove = vi.spyOn(char, "onDropMove").mockResolvedValue(true);
		const item = { type: "move", system: { moveType: "playbook" } };

		const { anyAdded, others } = await char.onDropItems([item]);

		expect(onDropMove).toHaveBeenCalledWith(item);
		expect(anyAdded).toBe(true);
		expect(others).toHaveLength(0);
	});

	it("returns anyAdded=false when onDropMove returns falsy", async () => {
		const char = makeChar();
		vi.spyOn(char, "onDropMove").mockResolvedValue(false);
		const item = { type: "move", system: { moveType: "basic" } };

		const { anyAdded } = await char.onDropItems([item]);

		expect(anyAdded).toBe(false);
	});

	it("returns non-move items as others and does not count them as added", async () => {
		const char = makeChar();
		const item = { type: "equipment", name: "Sword" };

		const { anyAdded, others } = await char.onDropItems([item]);

		expect(anyAdded).toBe(false);
		expect(others).toEqual([item]);
	});

	it("handles a mix and returns anyAdded=true only for handled items", async () => {
		const char = makeChar();
		vi.spyOn(char, "addArcanum").mockResolvedValue();
		vi.spyOn(char, "onDropMove").mockResolvedValue(false);
		const arcanum = { type: "equipment", system: { equipmentType: "arcanum", slug: "eye" } };
		const move = { type: "move", system: { moveType: "basic" } };
		const other = { type: "equipment" };

		const { anyAdded, others } = await char.onDropItems([arcanum, move, other]);

		expect(anyAdded).toBe(true);
		expect(others).toEqual([other]);
	});
});

// -- selectBackground ---------------------------------------------------------

describe("StonetopCharacter.selectBackground", () => {
	it("calls background.selectBackground with the slug", async () => {
		const char = new TestCharacterBuilder(new FakeActorBuilder().build()).build();
		const selectBg = vi.spyOn(char.background, "selectBackground").mockResolvedValue();

		await char.selectBackground("vessel");

		expect(selectBg).toHaveBeenCalledWith("vessel");
	});

	it("passes the slug through to background.selectBackground", async () => {
		const char = new TestCharacterBuilder(new FakeActorBuilder().build()).build();
		const selectBg = vi.spyOn(char.background, "selectBackground").mockResolvedValue();

		await char.selectBackground("initiate");

		expect(selectBg).toHaveBeenCalledWith("initiate");
	});
});


