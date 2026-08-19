import { describe, it, expect } from "vitest";
import { itemsOfType, itemOfTypeBySlug } from "../../src/actors/actorItems.js";

// Foundry's Collection and the plain array the fakes use both answer find/filter, so these work
// against either without the `[...actor.items]` copy the call sites used to make.
const actor = {
	items: [
		{ _id: "a1", type: "arcanum",  system: { slug: "azure-hand" } },
		{ _id: "f1", type: "follower", system: { slug: "enfys" } },
		{ _id: "f2", type: "follower", system: { slug: "crew" } },
		{ _id: "m1", type: "move",     system: {} },
	],
};

describe("itemsOfType", () => {
	it("returns every item of the type", () => {
		expect(itemsOfType(actor, "follower").map(i => i._id)).toEqual(["f1", "f2"]);
	});

	it("returns an empty list for a type the actor has none of", () => {
		expect(itemsOfType(actor, "possession")).toEqual([]);
	});

	it("tolerates an actor with no items", () => {
		expect(itemsOfType({}, "follower")).toEqual([]);
		expect(itemsOfType(null, "follower")).toEqual([]);
	});
});

describe("itemOfTypeBySlug", () => {
	it("finds the item carrying the slug", () => {
		expect(itemOfTypeBySlug(actor, "follower", "crew")._id).toBe("f2");
	});

	// Slugs are only unique WITHIN a type, so the type is part of the lookup.
	it("does not match a slug belonging to another type", () => {
		expect(itemOfTypeBySlug(actor, "follower", "azure-hand")).toBeNull();
	});

	it("answers null for an unknown slug", () => {
		expect(itemOfTypeBySlug(actor, "follower", "nobody")).toBeNull();
	});

	it("answers null for a missing slug rather than matching an item without one", () => {
		expect(itemOfTypeBySlug(actor, "move", undefined)).toBeNull();
		expect(itemOfTypeBySlug(actor, "move", "")).toBeNull();
	});

	it("tolerates an actor with no items", () => {
		expect(itemOfTypeBySlug({}, "follower", "enfys")).toBeNull();
	});
});
