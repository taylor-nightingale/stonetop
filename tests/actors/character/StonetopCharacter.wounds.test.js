import { describe, it, expect } from "vitest";
import { TestCharacterBuilder } from "../../fakes/TestCharacterBuilder.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { Wound } from "../../../src/model/data/character/Wound.js";

// Problematic wounds are authored in play: the player writes one down, steps it through its states as
// it is tended to, and removes it. The Ailments region reads them off the snapshot.

const character = (wounds = []) => {
	const actor = new FakeCharacterActorBuilder().withWounds(wounds).build();
	return { actor, character: new TestCharacterBuilder(actor).build() };
};

describe("StonetopCharacter — wounds", () => {
	it("puts the wounds on the snapshot", async () => {
		const { character: c } = character([{ id: "w1", name: "bad knee", state: "permanent" }]);
		expect((await c.buildSnapshot()).wounds).toEqual([new Wound("w1", "bad knee", "permanent")]);
	});

	it("has an empty list when there are none", async () => {
		const { character: c } = character();
		expect((await c.buildSnapshot()).wounds).toEqual([]);
	});

	it("writes a wound down, renames it, steps it on and removes it", async () => {
		const { actor, character: c } = character();
		const { id } = await c.addWound("broken arm");
		await c.renameWound(id, "shattered arm");
		await c.advanceWoundState(id);
		expect(actor.system.wounds).toEqual([{ id, name: "shattered arm", state: "stabilized" }]);
		await c.removeWound(id);
		expect(actor.system.wounds).toEqual([]);
	});

	it("clears away a wound nobody named", async () => {
		const { actor, character: c } = character([{ id: "w1", name: "", state: "active" }, { id: "w2", name: "cut", state: "active" }]);
		await c.removeUnnamedWounds();
		expect(actor.system.wounds).toEqual([{ id: "w2", name: "cut", state: "active" }]);
	});
});
