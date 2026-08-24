import { describe, expect, it } from "vitest";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";

function makeCharacter(actor) {
	return new StonetopCharacter(actor, new FakeRepositoryFactory());
}

// -- rollMode ------------------------------------------------------------------

describe("StonetopCharacter.rollMode", () => {
	it("returns stored flag value", () => {
		const actor = new FakeCharacterActorBuilder().withRollMode("adv").build();
		expect(makeCharacter(actor).rollMode).toBe("adv");
	});

	it("defaults to 'normal' when flag not set", () => {
		const actor = new FakeCharacterActorBuilder().build();
		expect(makeCharacter(actor).rollMode).toBe("normal");
	});

	it("setRollMode writes flag and updates rollMode", async () => {
		const actor = new FakeCharacterActorBuilder().build();
		const character = makeCharacter(actor);
		await character.setRollMode("adv");
		expect(character.rollMode).toBe("adv");
	});
});

// -- the side-bar's radio list -------------------------------------------------

// The snapshot answers which modes to draw and which is ticked, rather than the template deciding
// from a bare string — that is what lets the sheet and the stat-pick dialog share one partial.

describe("CharacterSnapshot.rollModes", () => {
	const snapshotOf = actor => makeCharacter(actor).buildSnapshot();

	it("offers the three modes", async () => {
		const snapshot = await snapshotOf(new FakeCharacterActorBuilder().build());
		expect(snapshot.rollModes.map(o => o.key)).toEqual(["adv", "normal", "dis"]);
	});

	it("ticks the mode the character is set to", async () => {
		const snapshot = await snapshotOf(new FakeCharacterActorBuilder().withRollMode("adv").build());
		expect(snapshot.rollModes.filter(o => o.checked).map(o => o.key)).toEqual(["adv"]);
	});

	it("ticks normal for a character that has never set one", async () => {
		const snapshot = await snapshotOf(new FakeCharacterActorBuilder().build());
		expect(snapshot.rollModes.find(o => o.checked).key).toBe("normal");
	});
});
