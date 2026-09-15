import { describe, it, expect } from "vitest";
import { NeighborPlace } from "../../../src/actors/steading/NeighborPlace.js";

const marshedge = () => NeighborPlace.fromRaw({
	slug: "marshedge", name: "Marshedge", subtitle: "", note: "Trades through",
	names: "Abben, Ailen", size: "town", travel: "4 days, the West Road",
});

describe("NeighborPlace.fromRaw", () => {
	it("defaults every absent field to an empty string", () => {
		const place = NeighborPlace.fromRaw({ slug: "lygos" });
		expect(place).toMatchObject({ slug: "lygos", name: "", subtitle: "", note: "", names: "", size: "", travel: "" });
	});

	// A steadfast's schema has no `travel` at all — it cannot say how far away a place is, because
	// that depends on where you are standing. Reading one off a steadfast must not explode.
	it("reads a row that carries no travel, as a steadfast's rows never do", () => {
		expect(NeighborPlace.fromRaw({ slug: "marshedge", size: "town" }).travel).toBe("");
	});
});

// The one description of what a steadfast owns and what the table does — read by BOTH the apply path
// and migrateNeighborPlaces, which is what stops the two drifting apart again.
describe("NeighborPlace.fromDefinition", () => {
	const definition = {
		slug: "marshedge", name: "Marshedge", subtitle: "on the Bluffs",
		note: "", names: "Abben, Ailen", size: "town", travel: "10 days",
	};

	it("takes the whole definition for a place the table has no row for", () => {
		expect(NeighborPlace.fromDefinition(definition)).toMatchObject({
			slug: "marshedge", name: "Marshedge", subtitle: "on the Bluffs",
			names: "Abben, Ailen", size: "town", travel: "10 days",
		});
	});

	// Whatever a definition happens to carry in that field is not this table's words.
	it("blanks the note on a row the steadfast has only just defined", () => {
		expect(NeighborPlace.fromDefinition({ ...definition, note: "Trades in iron" }).note).toBe("");
	});

	it("keeps the note the table wrote, and never the definition's", () => {
		const place = NeighborPlace.fromDefinition({ ...definition, note: "Trades in iron" },
			{ slug: "marshedge", note: "Owes us grain" });
		expect(place.note).toBe("Owes us grain");
	});

	it("keeps a note the table has since cleared, rather than refilling it", () => {
		const place = NeighborPlace.fromDefinition({ ...definition, note: "Trades in iron" },
			{ slug: "marshedge", note: "" });
		expect(place.note).toBe("");
	});

	it("re-takes the definitional half over whatever the stored row still says", () => {
		const place = NeighborPlace.fromDefinition(definition, {
			slug: "marshedge", name: "Marsh Edge", subtitle: "", names: "Abben", size: "hamlet",
		});
		expect(place).toMatchObject({
			name: "Marshedge", subtitle: "on the Bluffs", names: "Abben, Ailen", size: "town",
		});
	});

	it("keeps a travel time the table measured itself", () => {
		const place = NeighborPlace.fromDefinition(definition, { slug: "marshedge", travel: "9 days if you push" });
		expect(place.travel).toBe("9 days if you push");
	});

	it("seeds the book's time into a blank one — including a row of nothing but spaces", () => {
		for (const travel of ["", "   ", undefined])
			expect(NeighborPlace.fromDefinition(definition, { slug: "marshedge", travel }).travel).toBe("10 days");
	});

	// A steadfast's own rows carry no travel at all: it cannot say how far away a place is.
	it("leaves travel blank when neither side states one", () => {
		const place = NeighborPlace.fromDefinition({ slug: "other", name: "Other places" }, { slug: "other" });
		expect(place.travel).toBe("");
	});

	it("returns a NeighborPlace, and touches neither side", () => {
		const stored = { slug: "marshedge", note: "Owes us grain", travel: "9 days" };
		const place = NeighborPlace.fromDefinition(definition, stored);
		expect(place).toBeInstanceOf(NeighborPlace);
		expect(stored).toEqual({ slug: "marshedge", note: "Owes us grain", travel: "9 days" });
		expect(definition.note).toBe("");
	});
});

describe("NeighborPlace with-methods", () => {
	it("withNote replaces only the note", () => {
		const changed = marshedge().withNote("Desperate for grain");
		expect(changed.note).toBe("Desperate for grain");
		expect(changed).toMatchObject({ slug: "marshedge", size: "town", travel: "4 days, the West Road" });
	});

	it("withSize replaces only the size", () => {
		const changed = marshedge().withSize("city");
		expect(changed.size).toBe("city");
		expect(changed).toMatchObject({ note: "Trades through", travel: "4 days, the West Road" });
	});

	it("withTravel replaces only the travel", () => {
		const changed = marshedge().withTravel("a long day's march");
		expect(changed.travel).toBe("a long day's march");
		expect(changed).toMatchObject({ note: "Trades through", size: "town" });
	});

	it("withNames replaces only the name pool", () => {
		const changed = marshedge().withNames("Brin, Brogan");
		expect(changed.names).toBe("Brin, Brogan");
		expect(changed).toMatchObject({ note: "Trades through", size: "town" });
	});

	it("leaves the original untouched", () => {
		const place = marshedge();
		place.withSize("city").withTravel("months").withNote("gone");
		expect(place).toMatchObject({ size: "town", travel: "4 days, the West Road", note: "Trades through" });
	});

	it("returns a NeighborPlace, so the calls chain", () => {
		const changed = marshedge().withSize("village").withTravel("half a day");
		expect(changed).toBeInstanceOf(NeighborPlace);
		expect(changed).toMatchObject({ size: "village", travel: "half a day" });
	});
});
