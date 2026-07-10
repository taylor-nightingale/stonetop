import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActorRolling } from "../../../src/actors/ActorRolling.js";
import { RollRequest } from "../../../src/actors/RollRequest.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeRoll } from "../../fakes/foundry/FakeRoll.js";
import { FakeChatMessage } from "../../fakes/foundry/FakeChatMessage.js";
import { FakeDialog } from "../../fakes/foundry/FakeDialog.js";

// End-to-end: a real StonetopSteading resolves the bonus, ActorRolling builds the formula.
// Locks the off-by-one fix at the boundary that actually matters — the dice formula the player rolls.

function makeRolling() {
	const actor = new FakeSteadingBuilder().build();
	actor.getRollData = () => ({});
	actor.typedActor = new StonetopSteading(actor, { getAll: async () => [] }, new FakeMoveRepository());
	return new ActorRolling(actor);
}

beforeEach(() => {
	FakeRoll.reset();
	FakeChatMessage.reset();
	FakeDialog.reset();
	vi.stubGlobal("Roll", FakeRoll);
	vi.stubGlobal("ChatMessage", FakeChatMessage);
	vi.stubGlobal("Dialog", FakeDialog);
	vi.stubGlobal("game", { i18n: { localize: k => k } });
	foundry.applications.handlebars.renderTemplate = async () => "";
});

afterEach(() => {
	vi.unstubAllGlobals();
	foundry.applications.handlebars.renderTemplate = async () => "";
});

describe("Steading roll — attribute bonus (integration)", () => {
	it("rolls population index 1 as +0, not +1", async () => {
		const rolling = makeRolling();
		await rolling.execute(RollRequest.fromStat("population", "normal"));
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 0");
	});

	it("rolls fortunes index 2 as +1, not +2", async () => {
		const rolling = makeRolling();
		await rolling.execute(RollRequest.fromStat("fortunes", "normal"));
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 1");
	});

	it("reflects a raised prosperity value in the formula (+3)", async () => {
		const rolling = makeRolling();
		await rolling._actor.typedActor.attributes.setValue("prosperity", 3);
		await rolling.execute(RollRequest.fromStat("prosperity", "normal"));
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 3");
	});

	it("reflects a lowered defenses value in the formula (-1)", async () => {
		const rolling = makeRolling();
		await rolling._actor.typedActor.attributes.setValue("defenses", -1);
		await rolling.execute(RollRequest.fromStat("defenses", "normal"));
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + -1");
	});
});
