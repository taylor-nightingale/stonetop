import { describe, it, expect } from "vitest";
import { FollowerItem } from "../../../src/actors/character/FollowerItem.js";

const actor = {
	items: [
		{ _id: "enfys-item", type: "follower", system: { slug: "enfys", armor: "", damage: "d4" } },
		{ _id: "crew-item",  type: "follower", system: { slug: "crew" } },
		{ _id: "arc-item",   type: "arcanum",  system: { slug: "enfys" } },
	],
};

const found = slug => FollowerItem.bySlug(actor, slug);

describe("FollowerItem.bySlug", () => {
	it("finds the follower carrying the slug", () => {
		expect(found("crew").id).toBe("crew-item");
	});

	it("does not match another item type that happens to share the slug", () => {
		expect(found("enfys").id).toBe("enfys-item");
	});

	it("answers null for a slug no follower answers to", () => {
		expect(found("nobody")).toBeNull();
	});
});

describe("FollowerItem with-methods", () => {
	it("carries the id on every update", () => {
		expect(found("enfys").withArmor("1").toUpdate()._id).toBe("enfys-item");
	});

	it("names only the field it was given", () => {
		expect(found("enfys").withDamage("d6").toUpdate()).toEqual({
			_id: "enfys-item", system: { damage: "d6" },
		});
	});

	it("stores a load capacity as a number", () => {
		expect(found("enfys").withLoadCapacity("12").toUpdate()).toEqual({
			_id: "enfys-item", system: { loadCapacity: 12 },
		});
	});

	it("floors a nonsense capacity at zero rather than storing NaN", () => {
		expect(found("enfys").withLoadCapacity("-4").toUpdate().system.loadCapacity).toBe(0);
		expect(found("enfys").withLoadCapacity("").toUpdate().system.loadCapacity).toBe(0);
	});

	it("puts name at the top level, not under system", () => {
		expect(found("enfys").withName("Enfys the Bold").toUpdate()).toEqual({
			_id: "enfys-item", name: "Enfys the Bold",
		});
	});

	// Immutability: each with-method answers a new instance, so a held reference is never mutated.
	it("does not mutate the instance it was called on", () => {
		const original = found("enfys");

		original.withArmor("2");

		expect(original.toUpdate()).toEqual({ _id: "enfys-item" });
	});

	it("accumulates several fields into one update", () => {
		const update = found("enfys").withArmor("1 (hide)").withDamage("d6").withNotes("owes a debt").toUpdate();

		expect(update).toEqual({
			_id: "enfys-item",
			system: { armor: "1 (hide)", damage: "d6", notes: "owes a debt" },
		});
	});

	it("trims the single-line fields", () => {
		expect(found("enfys").withArmor("  1 (hide)  ").toUpdate().system.armor).toBe("1 (hide)");
		expect(found("enfys").withDamage("  d6  ").toUpdate().system.damage).toBe("d6");
	});

	// Free text keeps its shape — leading indentation in a moves list is the player's.
	it("leaves the free-text fields untrimmed", () => {
		expect(found("enfys").withMoves("  - Bite d6  ").toUpdate().system.moves).toBe("  - Bite d6  ");
		expect(found("enfys").withDescription("  a slight figure ").toUpdate().system.description)
			.toBe("  a slight figure ");
	});

	it("writes HP current and max independently", () => {
		expect(found("enfys").withHp(4).toUpdate()).toEqual({ _id: "enfys-item", system: { hp: { value: 4 } } });
		expect(found("enfys").withHpMax(9).toUpdate()).toEqual({ _id: "enfys-item", system: { hp: { max: 9 } } });
	});

	it("combines HP current and max when both are given", () => {
		expect(found("enfys").withHpMax(9).withHp(4).toUpdate().system.hp).toEqual({ max: 9, value: 4 });
	});

	it("produces a no-op update when nothing was changed", () => {
		expect(found("enfys").toUpdate()).toEqual({ _id: "enfys-item" });
	});
});
