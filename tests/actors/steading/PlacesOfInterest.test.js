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

describe("PlacesOfInterest — document linking", () => {
	it("linkDocument stores the uuid and preserves the place name", async () => {
		const poi = make();
		await poi.linkDocument(0, "JournalEntry.abc");
		const snapshot = poi.buildSnapshot();
		expect(snapshot[0].linkUuid).toBe("JournalEntry.abc");
		expect(snapshot[0].value).toBe("The Stone");
	});

	it("buildSnapshot exposes a docLink @UUID token for a linked place", async () => {
		const poi = make();
		await poi.linkDocument(0, "JournalEntry.abc");
		expect(poi.buildSnapshot()[0].docLink.raw).toBe("@UUID[JournalEntry.abc]");
	});

	it("links any document type (an actor, not just a journal)", async () => {
		const poi = make();
		await poi.linkDocument(0, "Actor.a1");
		expect(poi.buildSnapshot()[0].docLink.raw).toBe("@UUID[Actor.a1]");
	});

	it("an unlinked place has a null docLink", async () => {
		expect(make().buildSnapshot()[0].docLink).toBeNull();
	});

	it("unlinkDocument clears the uuid and the link", async () => {
		const poi = make();
		await poi.linkDocument(0, "JournalEntry.abc");
		await poi.unlinkDocument(0);
		const snapshot = poi.buildSnapshot();
		expect(snapshot[0].linkUuid).toBe("");
		expect(snapshot[0].docLink).toBeNull();
	});

	it("does not affect other places", async () => {
		const poi = make();
		await poi.linkDocument(2, "JournalEntry.abc");
		expect(poi.buildSnapshot()[0].linkUuid).toBe("");
		expect(poi.buildSnapshot()[2].linkUuid).toBe("JournalEntry.abc");
	});
});
