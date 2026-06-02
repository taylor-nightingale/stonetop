import { describe, it, expect } from "vitest";
import { CharacterDebilities } from "../../../src/actors/character/CharacterDebilities.js";
import {FakeActorBuilder} from "../../fakes/FakeActorBuilder.js";


describe("CharacterDebilities.setDebility", () => {
	it("sets weakened to true", async () => {
		const actor = new FakeActorBuilder().build();
		let characterDebilities = new CharacterDebilities(actor);
		await characterDebilities.setDebility("weakened", true);
		expect(actor.system.attributes.debilities.options.weakened.value).toBe(true);
	});

	it("sets weakened back to false", async () => {
		const actor = new FakeActorBuilder().build();
		let debilities = new CharacterDebilities(actor);
		await debilities.setDebility("weakened", true);
		await debilities.setDebility("weakened", false);
		expect(actor.system.attributes.debilities.options.weakened.value).toBe(false);
	});

	it("sets dazed independently of weakened", async () => {
		const actor = new FakeActorBuilder().build();
		let debilities = new CharacterDebilities(actor);
		await debilities.setDebility("dazed", true);
		expect(actor.system.attributes.debilities.options.dazed.value).toBe(true);
		expect(actor.system.attributes.debilities.options.weakened.value).toBe(false);
	});

	it("sets miserable independently", async () => {
		const actor = new FakeActorBuilder().build();
		let debilities = new CharacterDebilities(actor);
		await debilities.setDebility("miserable", true);
		expect(actor.system.attributes.debilities.options.miserable.value).toBe(true);
	});

	it("multiple debilities can be active simultaneously", async () => {
		const actor = new FakeActorBuilder().build();
		let debilities = new CharacterDebilities(actor);
		await debilities.setDebility("weakened", true);
		await debilities.setDebility("dazed", true);
		expect(actor.system.attributes.debilities.options.weakened.value).toBe(true);
		expect(actor.system.attributes.debilities.options.dazed.value).toBe(true);
	});
});
