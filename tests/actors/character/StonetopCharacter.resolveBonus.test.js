import { describe, expect, it } from "vitest";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder, FakeStatBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { TestInsertItemBuilder } from "../../fakes/TestInsertItemBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeSteadingRepository } from "../../fakes/FakeSteadingRepository.js";

// A character rolls its own six stats; a move like Requisition reaches past them to the steading it
// calls home. Both typed actors answer resolveBonus the same way, so the character hands the lookup
// down the chain rather than knowing which keys belong to a steading.

function makeCharacter({ stats = new FakeStatBuilder(), steading = null, items = [] } = {}) {
	const actor = new FakeCharacterActorBuilder().withStats(stats).withItems(items).build();
	return new StonetopCharacter(actor, new FakeRepositoryFactory({
		steading: steading ?? new FakeSteadingRepository(),
	}));
}

// A Thrall insert plus the Favor move it grants. Real items on a real character, so the chain is
// exercised end to end rather than through a stubbed CharacterInserts. The track starts at 0; move
// it with setMoveResourceCurrent, the same call the sheet makes.
function thrall() {
	return [
		new TestInsertItemBuilder().withId("i-thrall").withSlug("thrall").withName("Thrall")
			.withMoves(["favor", "dark-succor"]).build(),
		{ _id: "m-favor", type: "move", name: "Favor",
			system: { slug: "favor", categoryKey: "insert-thrall", resource: { max: 3, title: "Favor", labels: [] } } },
	];
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

	it("does not offer insert tracks among the rollable stats either", () => {
		expect(makeCharacter({ items: thrall() }).getRollableStats().map(s => s.key)).not.toContain("favor");
	});
});

// The chain is stats → inserts → steading; each link only answers what the one before it couldn't.
describe("StonetopCharacter.resolveBonus — the insert link", () => {
	it("resolves an insert's own track (Dark Succor's +Favor)", () => {
		expect(makeCharacter({ items: thrall() }).resolveBonus("favor")).toBe(0);
	});

	it("reads the track's current value", async () => {
		const character = makeCharacter({ items: thrall() });
		await character.setMoveResourceCurrent("favor", 2);
		expect(character.resolveBonus("favor")).toBe(2);
	});

	it("is null for a track no insert the character carries grants", () => {
		expect(makeCharacter().resolveBonus("favor")).toBeNull();
	});

	it("asks the steading only after the inserts come up empty", () => {
		const character = makeCharacter({ items: thrall(), steading: stonetop({ fortunes: 1 }) });
		expect(character.resolveBonus("favor")).toBe(0);
		expect(character.resolveBonus("fortunes")).toBe(1);
	});

	it("prefers the character's own stat over an insert track of the same name", () => {
		const items = thrall();
		items[0].system.moves = ["wis"];
		const character = makeCharacter({ stats: new FakeStatBuilder().withWis(3), items });
		expect(character.resolveBonus("wis")).toBe(3);
	});
});
