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

// -- clearRollMode -------------------------------------------------------------

// Advantage is FORWARD: it applies to your next roll and is then gone. Held as a flag it behaved as
// neither forward nor ongoing — set once, it bent every roll after it until somebody noticed the
// wrong word was still lit. The flag stays (a roll has to be able to read it), but a roll spends it.

describe("StonetopCharacter.clearRollMode", () => {
	it("gives the mode back to normal", async () => {
		const character = makeCharacter(new FakeCharacterActorBuilder().withRollMode("adv").build());
		await character.clearRollMode();
		expect(character.rollMode).toBe("normal");
	});

	it("clears disadvantage too, not just advantage", async () => {
		const character = makeCharacter(new FakeCharacterActorBuilder().withRollMode("dis").build());
		await character.clearRollMode();
		expect(character.rollMode).toBe("normal");
	});

	// A write per roll on a flag that already says "normal" is a document update, which is a render
	// for every client with the sheet open — for nothing. Most rolls are made at normal.
	it("writes nothing when the mode is already normal", async () => {
		const actor = new FakeCharacterActorBuilder().build();
		let writes = 0;
		const original = actor.setFlag.bind(actor);
		actor.setFlag = (...args) => { writes++; return original(...args); };

		await makeCharacter(actor).clearRollMode();

		expect(writes, "an already-normal mode was rewritten").toBe(0);
	});

	it("is idempotent", async () => {
		const character = makeCharacter(new FakeCharacterActorBuilder().withRollMode("adv").build());
		await character.clearRollMode();
		await character.clearRollMode();
		expect(character.rollMode).toBe("normal");
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
