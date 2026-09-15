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
