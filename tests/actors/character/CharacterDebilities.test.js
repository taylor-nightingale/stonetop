import { describe, it, expect } from "vitest";
import { CharacterDebilities } from "../../../module/actors/character/CharacterDebilities.js";
import { FakeActor } from "../../fakes/FakeActor.js";

function makeDebilities(attrs = {}) {
	return new CharacterDebilities(new FakeActor(attrs));
}

function actorFor(debilities) {
	const actor = new FakeActor({
		debilities: { options: { weakened: { value: false }, dazed: { value: false }, miserable: { value: false } } },
	});
	return { debilities: new CharacterDebilities(actor), actor };
}

describe("CharacterDebilities.setDebility", () => {
	it("sets weakened to true", async () => {
		const { debilities, actor } = actorFor();
		await debilities.setDebility("weakened", true);
		expect(actor.system.attributes.debilities.options.weakened.value).toBe(true);
	});

	it("sets weakened back to false", async () => {
		const actor = new FakeActor({
			debilities: { options: { weakened: { value: true } } },
		});
		const debilities = new CharacterDebilities(actor);
		await debilities.setDebility("weakened", false);
		expect(actor.system.attributes.debilities.options.weakened.value).toBe(false);
	});

	it("sets dazed independently of weakened", async () => {
		const { debilities, actor } = actorFor();
		await debilities.setDebility("dazed", true);
		expect(actor.system.attributes.debilities.options.dazed.value).toBe(true);
		expect(actor.system.attributes.debilities.options.weakened.value).toBe(false);
	});

	it("sets miserable independently", async () => {
		const { debilities, actor } = actorFor();
		await debilities.setDebility("miserable", true);
		expect(actor.system.attributes.debilities.options.miserable.value).toBe(true);
	});

	it("multiple debilities can be active simultaneously", async () => {
		const { debilities, actor } = actorFor();
		await debilities.setDebility("weakened", true);
		await debilities.setDebility("dazed", true);
		expect(actor.system.attributes.debilities.options.weakened.value).toBe(true);
		expect(actor.system.attributes.debilities.options.dazed.value).toBe(true);
	});
});
