import { describe, it, expect } from "vitest";
import { NeighborPlaces } from "../../../src/actors/steading/NeighborPlaces.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";

function make() {
	return new NeighborPlaces(new FakeSteadingBuilder().build());
}

describe("NeighborPlaces.buildSnapshot", () => {
	it("returns 5 places from system defaults", () => {
		expect(make().buildSnapshot()).toHaveLength(5);
	});

	it("places have correct names in order", () => {
		const names = make().buildSnapshot().map(p => p.name);
		expect(names).toEqual(["Marshedge", "Gordin's Delve", "The Steplands", "Lygos", "Other places"]);
	});

	it("places have correct slugs", () => {
		const slugs = make().buildSnapshot().map(p => p.slug);
		expect(slugs).toEqual(["marshedge", "gordins-delve", "steplands", "lygos", "other"]);
	});

	it("places with subtitles have correct subtitle", () => {
		const snap = make().buildSnapshot();
		expect(snap.find(p => p.slug === "steplands").subtitle).toBe("Hillfolk");
		expect(snap.find(p => p.slug === "lygos").subtitle).toBe("and other points south");
		expect(snap.find(p => p.slug === "other").subtitle).toBe("Barrier Pass, the Manmarch, etc.");
	});

	it("places without subtitles have empty subtitle", () => {
		const snap = make().buildSnapshot();
		expect(snap.find(p => p.slug === "marshedge").subtitle).toBe("");
		expect(snap.find(p => p.slug === "gordins-delve").subtitle).toBe("");
	});

	it("Marshedge has the correct names string", () => {
		const snap = make().buildSnapshot();
		expect(snap.find(p => p.slug === "marshedge").names).toContain("Abben");
	});
});

describe("NeighborPlaces.updateNote", () => {
	it("persists the note for the matching place", async () => {
		const np = make();
		await np.updateNote("marshedge", "Key trading partner");
		expect(np.buildSnapshot().find(p => p.slug === "marshedge").note).toBe("Key trading partner");
	});

	it("does not affect other places", async () => {
		const np = make();
		await np.updateNote("marshedge", "Key trading partner");
		expect(np.buildSnapshot().find(p => p.slug === "lygos").note).toBe("");
	});
});

describe("NeighborPlaces.updateNames", () => {
	it("persists the names string for the matching place", async () => {
		const np = make();
		await np.updateNames("other", "Edda, Birna, Orm");
		expect(np.buildSnapshot().find(p => p.slug === "other").names).toBe("Edda, Birna, Orm");
	});

	it("does not affect other places", async () => {
		const np = make();
		const originalNames = np.buildSnapshot().find(p => p.slug === "marshedge").names;
		await np.updateNames("other", "Edda, Birna");
		expect(np.buildSnapshot().find(p => p.slug === "marshedge").names).toBe(originalNames);
	});
});
