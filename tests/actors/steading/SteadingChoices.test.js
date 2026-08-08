import { describe, it, expect } from "vitest";
import { SteadingChoices } from "../../../src/actors/steading/SteadingChoices.js";
import { ChoiceTarget } from "../../../src/actors/character/ChoiceTarget.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";

function build() {
	const actor = new FakeSteadingBuilder().build();
	return { actor, choices: new SteadingChoices(actor) };
}

const target = fields => new ChoiceTarget({ context: "steading", group: "gains", ...fields });
const raw    = actor => actor.system.choiceValues ?? {};

describe("SteadingChoices", () => {
	it("reads empty on a steading that has picked nothing", () => {
		expect(build().choices.values.getCount("gains", "news")).toBe(0);
	});

	it("records a plain checkbox pick", async () => {
		const { choices } = build();
		await choices.setPickFor(target({ option: "news" }), true);
		expect(choices.values.getCount("gains", "news")).toBe(1);
	});

	it("clears a plain checkbox pick when it is unchecked", async () => {
		const { choices } = build();
		await choices.setPickFor(target({ option: "news" }), true);
		await choices.setPickFor(target({ option: "news" }), false);
		expect(choices.values.getCount("gains", "news")).toBe(0);
	});

	// A "pick 1" row is radios: every option names its siblings, and picking one has to release
	// whichever was picked before — a checkbox that can only ever be ticked was the original bug.
	it("releases the previous pick when a sibling is chosen", async () => {
		const { choices } = build();
		await choices.setPickFor(target({ option: "tor", siblingsCsv: "tor,news" }));
		await choices.setPickFor(target({ option: "news", siblingsCsv: "tor,news" }));
		expect(choices.values.getCount("gains", "tor")).toBe(0);
		expect(choices.values.getCount("gains", "news")).toBe(1);
	});

	// Foundry deep-merges updates, so a released sibling has to be written as 0 — dropping its key
	// would leave the old value in the document.
	it("writes a released sibling as zero rather than dropping its key", async () => {
		const { actor, choices } = build();
		await choices.setPickFor(target({ option: "tor", siblingsCsv: "tor,news" }));
		await choices.setPickFor(target({ option: "news", siblingsCsv: "tor,news" }));
		expect(raw(actor).gains.tor).toBe(0);
	});

	it("keeps other groups' picks when one group is written", async () => {
		const { choices } = build();
		await choices.setPickFor(new ChoiceTarget({ context: "steading", group: "other", option: "x" }), true);
		await choices.setPickFor(target({ option: "news" }), true);
		expect(choices.values.getCount("other", "x")).toBe(1);
	});

	it("ignores a target with no group or option", async () => {
		const { actor, choices } = build();
		await choices.setPickFor(new ChoiceTarget({ context: "steading" }), true);
		await choices.setPickFor(target({}), true);
		expect(raw(actor)).toEqual({});
	});
});
