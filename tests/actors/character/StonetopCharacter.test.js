import { describe, expect, it, vi } from "vitest";
import {TestCharacterBuilder} from "../../fakes/TestCharacterBuilder.js";
import {FakeActorBuilder} from "../../fakes/FakeActorBuilder.js";

// -- onDropItems --------------------------------------------------------------

describe("StonetopCharacter.onDropItems", () => {
	function makeChar() {
		return new TestCharacterBuilder(new FakeActorBuilder().build()).build();
	}

	it("returns arcanum items in others for Foundry to embed natively", async () => {
		const char = makeChar();
		const item = { type: "arcanum", system: { slug: "shell-game" } };

		const { anyAdded, others } = await char.onDropItems([item]);

		expect(others).toContain(item);
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

	it("returns non-move non-follower items as others", async () => {
		const char = makeChar();
		const item = { type: "outfitItem", name: "Sword" };

		const { anyAdded, others } = await char.onDropItems([item]);

		expect(anyAdded).toBe(false);
		expect(others).toContain(item);
	});

	it("handles a mix: moves handled internally, arcana and others returned for embedding", async () => {
		const char = makeChar();
		vi.spyOn(char, "onDropMove").mockResolvedValue(false);
		const arcanum = { type: "arcanum", system: { slug: "eye" } };
		const move = { type: "move", system: { moveType: "basic" } };
		const other = { type: "outfitItem" };

		const { anyAdded, others } = await char.onDropItems([arcanum, move, other]);

		expect(anyAdded).toBe(false);
		expect(others).toContain(arcanum);
		expect(others).toContain(other);
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


