import { describe, it, expect } from "vitest";
import { PlacesOfInterest } from "../../../src/actors/steading/PlacesOfInterest.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";

function make() {
	return new PlacesOfInterest(new FakeSteadingBuilder().build());
}

describe("PlacesOfInterest.buildSnapshot", () => {
	it("returns default places from system", () => {
		const snapshot = make().buildSnapshot();
		expect(snapshot.length).toBe(6);
		expect(snapshot[0].key).toBe("A");
		expect(snapshot[0].value).toBe("The Stone");
	});

	it("assigns sequential letter keys", () => {
		const snapshot = make().buildSnapshot();
		expect(snapshot.map(p => p.key)).toEqual(["A", "B", "C", "D", "E", "F"]);
	});

	it("each entry has its index", () => {
		const snapshot = make().buildSnapshot();
		expect(snapshot.map(p => p.index)).toEqual([0, 1, 2, 3, 4, 5]);
	});
});

describe("PlacesOfInterest.addBlankPlace", () => {
	it("appends a blank place to the end", async () => {
		const poi = make();
		await poi.addBlankPlace();
		const snapshot = poi.buildSnapshot();
		expect(snapshot.length).toBe(7);
		expect(snapshot[6].key).toBe("G");
		expect(snapshot[6].value).toBe("");
	});
});

describe("PlacesOfInterest.setPlaceValue", () => {
	it("updates the value at the given index", async () => {
		const poi = make();
		await poi.setPlaceValue(2, "new-value");
		const snapshot = poi.buildSnapshot();
		expect(snapshot.length).toBe(6);
		expect(snapshot[2].key).toBe("C");
		expect(snapshot[2].value).toBe("new-value");
	});

	it("does not affect other places", async () => {
		const poi = make();
		await poi.setPlaceValue(2, "new-value");
		const snapshot = poi.buildSnapshot();
		expect(snapshot[0].value).toBe("The Stone");
		expect(snapshot[1].value).toBe("The Granary");
	});
});
