import { describe, it, expect } from "vitest";
import {SteadingAttributes} from "../../../module/actors/steading/SteadingAttributes.js";
import {FakeActorBuilder} from "../../fakes/FakeActorBuilder.js";

describe("SteadingAttributes.buildSnapshot", () => {
	it("size has default values", async () => {
		const attributes = new SteadingAttributes(new FakeActorBuilder().build());
		const snapshot = await attributes.buildSnapshot();
		expect(snapshot.size.title).toBe("Size");
		expect(snapshot.size.note).toBe("Starts at <em>village</em>");
		expect(snapshot.size.current).toBe(1);
		expect(snapshot.size.items.length).toBe(0);
	});

	it("population has default values", async () => {
		const attributes = new SteadingAttributes(new FakeActorBuilder().build());
		const snapshot = await attributes.buildSnapshot();
		expect(snapshot.population.title).toBe("Population");
		expect(snapshot.population.note).toBe("Starts at +0");
		expect(snapshot.population.current).toBe(1);
		expect(snapshot.population.items.length).toBe(0);
	});

	it("prosperity has default values", async () => {
		const attributes = new SteadingAttributes(new FakeActorBuilder().build());
		const snapshot = await attributes.buildSnapshot();
		expect(snapshot.prosperity.title).toBe("Prosperity");
		expect(snapshot.prosperity.note).toBe("Starts at +0");
		expect(snapshot.prosperity.current).toBe(1);
		expect(snapshot.prosperity.items.length).toBe(8);
	});

	it("defenses has default values", async () => {
		const attributes = new SteadingAttributes(new FakeActorBuilder().build());
		const snapshot = await attributes.buildSnapshot();
		expect(snapshot.defenses.title).toBe("Defenses");
		expect(snapshot.defenses.note).toBe("Starts at +0");
		expect(snapshot.defenses.current).toBe(1);
		expect(snapshot.defenses.items.length).toBe(4);
	});
});


