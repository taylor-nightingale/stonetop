import { describe, expect, it } from "vitest";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder, FakeStatBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeSteadingRepository } from "../../fakes/FakeSteadingRepository.js";

// A character rolls its own six stats; a move like Requisition reaches past them to the steading it
// calls home. Both typed actors answer resolveBonus the same way, so the character hands the lookup
// down the chain rather than knowing which keys belong to a steading.

function makeCharacter({ stats = new FakeStatBuilder(), steading = null } = {}) {
	const actor = new FakeCharacterActorBuilder().withStats(stats).build();
	return new StonetopCharacter(actor, new FakeRepositoryFactory({
		steading: steading ?? new FakeSteadingRepository(),
	}));
}

const stonetop = (attributes) => FakeSteadingRepository.withSteading({ attributes });

describe("StonetopCharacter.resolveBonus", () => {
	it("resolves the character's own stat", () => {
		expect(makeCharacter({ stats: new FakeStatBuilder().withWis(2) }).resolveBonus("wis")).toBe(2);
	});

	it("falls through to the home steading for a stat the character has no notion of", () => {
		const character = makeCharacter({ steading: stonetop({ fortunes: 1 }) });
		expect(character.resolveBonus("fortunes")).toBe(1);
	});

	it("carries a negative steading rating through", () => {
		expect(makeCharacter({ steading: stonetop({ fortunes: -1 }) }).resolveBonus("fortunes")).toBe(-1);
	});

	it("prefers the character's own stat over a steading rating of the same name", () => {
		const character = makeCharacter({
			stats:    new FakeStatBuilder().withWis(3),
			steading: stonetop({ wis: 99 }),
		});
		expect(character.resolveBonus("wis")).toBe(3);
	});

	it("is null when the world has no steading — ActorRolling posts the move text instead", () => {
		expect(makeCharacter().resolveBonus("fortunes")).toBeNull();
	});

	it("is null for a key neither the character nor the steading knows", () => {
		expect(makeCharacter({ steading: stonetop({ fortunes: 1 }) }).resolveBonus("loyalty")).toBeNull();
	});

	// The sidebar's stat buttons and the "ask" dialog stay the character's own six.
	it("does not offer steading ratings among the rollable stats", () => {
		const character = makeCharacter({ steading: stonetop({ fortunes: 1 }) });
		expect(character.getRollableStats().map(s => s.key)).not.toContain("fortunes");
	});
});
