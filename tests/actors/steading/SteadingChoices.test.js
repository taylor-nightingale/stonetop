import { describe, it, expect } from "vitest";
import { SteadingChoices } from "../../../src/actors/steading/SteadingChoices.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";

// SteadingChoices owns ONE thing: the steading's own choice values, in system.choiceValues. What a
// pick MEANS (exclusive, releasable, announced to subscribers) belongs to ChoiceGroupController and
// is tested there; what routes a context to this store belongs to StonetopSteading and is tested
// there. This file is just the store — does it read and write the field it claims.

function build() {
	const actor = new FakeSteadingBuilder().build();
	return { actor, choices: new SteadingChoices(actor) };
}

describe("SteadingChoices", () => {
	it("reads empty on a steading that has picked nothing", () => {
		expect(build().choices.values.getCount("gains", "news")).toBe(0);
	});

	it("reads back what is stored in system.choiceValues", () => {
		const { actor, choices } = build();
		actor.system.choiceValues = { gains: { news: 1 } };
		expect(choices.values.getCount("gains", "news")).toBe(1);
	});

	it("writes through its controller into system.choiceValues", async () => {
		const { actor, choices } = build();
		await choices.controller().setCount("gains", "news", 1);
		expect(actor.system.choiceValues).toEqual({ gains: { news: 1 } });
	});

	// Every context the steading resolves to this store shares it, so a write under one group must
	// not disturb another.
	it("keeps other groups intact when one is written", async () => {
		const { actor, choices } = build();
		await choices.controller().setCount("other", "x", 1);
		await choices.controller().setCount("gains", "news", 1);
		expect(actor.system.choiceValues.other.x).toBe(1);
	});
});
