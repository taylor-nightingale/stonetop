import { describe, it, expect } from "vitest";
import { NeighborPlaces } from "../../../src/actors/steading/NeighborPlaces.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";

function make() {
	return new NeighborPlaces(new FakeSteadingBuilder().build());
}

describe("NeighborPlaces.buildSnapshot", () => {
	it("returns 6 places from system defaults", () => {
		expect(make().buildSnapshot()).toHaveLength(6);
	});

	it("places have correct names in order", () => {
		const names = make().buildSnapshot().map(p => p.name);
		expect(names).toEqual(["Marshedge", "Gordin's Delve", "The Steplands", "Lygos", "Barrier Pass", "Other places"]);
	});

	it("places have correct slugs", () => {
		const slugs = make().buildSnapshot().map(p => p.slug);
		expect(slugs).toEqual(["marshedge", "gordins-delve", "steplands", "lygos", "barrier-pass", "other"]);
	});

	it("places with subtitles have correct subtitle", () => {
		const snap = make().buildSnapshot();
		expect(snap.find(p => p.slug === "steplands").subtitle).toBe("Hillfolk");
		expect(snap.find(p => p.slug === "lygos").subtitle).toBe("and other points south");
		expect(snap.find(p => p.slug === "other").subtitle).toBe("The Manmarch, etc.");
	});

	it("places without subtitles have empty subtitle", () => {
		const snap = make().buildSnapshot();
		expect(snap.find(p => p.slug === "marshedge").subtitle).toBe("");
	});

	// Gordin's Delve has no name pool of its own — everyone there came from somewhere else — and
	// FolkSuggestions drops an empty list rather than printing an empty title. It carried the book's
	// instruction as a SUBTITLE until packs/src/steadfasts/stonetop.json dropped that text; the
	// subtitle sits beside the name on the Places tab, which is not where a note about naming belongs.
	it("leaves Gordin's Delve without a name pool", () => {
		const place = make().buildSnapshot().find(p => p.slug === "gordins-delve");
		expect(place.names).toBe("");
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

// Size is DEFINITIONAL — the book's word for the place — and Stonetop's steadfast carries it for the
// two neighbours that are steadings. The other three are regions the book gives no size at all.
describe("NeighborPlaces — size", () => {
	it("carries the size the steadfast defines", () => {
		const bySlug = Object.fromEntries(make().buildSnapshot().map(p => [p.slug, p.size]));
		expect(bySlug).toMatchObject({ marshedge: "town", "gordins-delve": "town" });
	});

	it("leaves the groupings unsized — they are regions, not steadings", () => {
		const bySlug = Object.fromEntries(make().buildSnapshot().map(p => [p.slug, p.size]));
		expect(bySlug).toMatchObject({ steplands: "", lygos: "", other: "" });
	});

	// The KEY, not the word: the fake i18n falls back to it, which is what proves the right one is
	// being asked for — the tier words themselves live in en.json.
	it("offers the book's word for the size, for the sheet that only reads it", () => {
		expect(make().buildSnapshot().find(p => p.slug === "marshedge").sizeLabel)
			.toBe("stonetop.steading.tier.size.town");
	});

	it("offers no word where no size is set, rather than the first tier", () => {
		expect(make().buildSnapshot().find(p => p.slug === "lygos").sizeLabel).toBe("");
	});

	// A select with nothing matching silently displays its first option, so an unsized place would
	// read as "hamlet" — a value nobody chose.
	it("offers a blank leading option, ticked, when nothing is chosen", () => {
		const options = make().buildSnapshot().find(p => p.slug === "lygos").sizeOptions;
		expect(options[0]).toMatchObject({ value: "", selected: true });
		expect(options.map(o => o.value)).toEqual(["", "hamlet", "village", "town", "city"]);
	});

	it("offers no blank option once a size is chosen, and ticks that one", () => {
		const options = make().buildSnapshot().find(p => p.slug === "marshedge").sizeOptions;
		expect(options.map(o => o.value)).toEqual(["hamlet", "village", "town", "city"]);
		expect(options.filter(o => o.selected).map(o => o.value)).toEqual(["town"]);
	});

	it("persists a new size for the matching place only", async () => {
		const np = make();
		await np.updateSize("marshedge", "city");
		expect(np.buildSnapshot().find(p => p.slug === "marshedge").size).toBe("city");
		expect(np.buildSnapshot().find(p => p.slug === "gordins-delve").size).toBe("town");
	});
});

// Travel is the opposite case: measured FROM the steading holding the list, so a steadfast has no
// such field and only a steading ever writes one.
describe("NeighborPlaces.updateTravel", () => {
	it("persists the travel time for the matching place", async () => {
		const np = make();
		await np.updateTravel("marshedge", "4 days, the West Road");
		expect(np.buildSnapshot().find(p => p.slug === "marshedge").travel).toBe("4 days, the West Road");
	});

	it("does not affect other places", async () => {
		const np = make();
		const before = np.buildSnapshot().find(p => p.slug === "lygos").travel;
		await np.updateTravel("marshedge", "4 days");
		expect(np.buildSnapshot().find(p => p.slug === "lygos").travel).toBe(before);
	});

	it("leaves the definitional half of the row alone", async () => {
		const np = make();
		await np.updateTravel("marshedge", "4 days");
		expect(np.buildSnapshot().find(p => p.slug === "marshedge"))
			.toMatchObject({ name: "Marshedge", size: "town" });
	});

	it("ignores a slug no row carries, rather than growing the list", async () => {
		const np = make();
		await np.updateTravel("nowhere", "a week");
		expect(np.buildSnapshot()).toHaveLength(6);
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
