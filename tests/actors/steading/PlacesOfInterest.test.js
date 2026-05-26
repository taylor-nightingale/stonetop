import { describe, it, expect } from "vitest";
import {PlacesOfInterest} from "../../../module/actors/steading/PlacesOfInterest.js";
import {FakeActorBuilder} from "../../fakes/FakeActorBuilder.js";


describe("PlacesOfInterest.buildSnapshot", () => {
	it("uses default places when none set", async () => {
		const poi = new PlacesOfInterest(new FakeActorBuilder().build());
		const snapshot = await poi.buildSnapshot();
		expect(snapshot.length).toBe(6);
		expect(snapshot[0].key).toBe("A");
		expect(snapshot[0].value).toBe("The Stone");
	});

	it("adds a new place to the end", async () => {
		const poi = new PlacesOfInterest(new FakeActorBuilder().build());
		await poi.addBlankPlace();
		const snapshot = await poi.buildSnapshot();

		expect(snapshot.length).toBe(7);
		expect(snapshot[6].key).toBe("G");
		expect(snapshot[6].value).toBe("");
	});

	it("Update a place's value", async () => {
		const poi = new PlacesOfInterest(new FakeActorBuilder().build());
		await poi.buildSnapshot();

		await poi.setPlaceValue(2, "new-value")
		const snapshot = await poi.buildSnapshot();

		expect(snapshot.length).toBe(6);
		expect(snapshot[2].key).toBe("C");
		expect(snapshot[2].value).toBe("new-value");
	});
});

