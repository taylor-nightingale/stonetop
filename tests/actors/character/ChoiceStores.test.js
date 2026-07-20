import { describe, it, expect } from "vitest";
import { ChoiceStores } from "../../../src/actors/character/ChoiceStores.js";
import { ChoiceTarget } from "../../../src/actors/character/ChoiceTarget.js";

// Every choice row the sheet renders stamps the context it belongs to. Registration keyed by that
// context lets each host own how its own rows resolve to a controller, so adding a choice-bearing item
// type is a registration at the composition root rather than an edit to shared dispatch code.

const target = (over = {}) => new ChoiceTarget({ context: "arcana", group: "g", option: "o", ...over });

describe("ChoiceStores", () => {
	it("resolves a registered context to its controller", () => {
		const ctrl   = { name: "arcana-ctrl" };
		const stores = new ChoiceStores().register("arcana", () => ctrl);

		expect(stores.resolve(target())).toBe(ctrl);
	});

	it("hands the target to the resolver, so it can find the right document", () => {
		let seen = null;
		const stores = new ChoiceStores().register("arcana", t => { seen = t; return {}; });
		const t = target({ arcanumSlug: "ring-of-daagon" });

		stores.resolve(t);

		expect(seen).toBe(t);
	});

	it("registers one resolver under several contexts", () => {
		const ctrl   = { name: "playbook-ctrl" };
		const stores = new ChoiceStores().register(["lore", "appearance", "intro-pc"], () => ctrl);

		for (const context of ["lore", "appearance", "intro-pc"]) {
			expect(stores.resolve(target({ context }))).toBe(ctrl);
		}
	});

	it("chains registrations", () => {
		const stores = new ChoiceStores()
			.register("arcana", () => "a")
			.register("move",   () => "m");

		expect(stores.resolve(target({ context: "move" }))).toBe("m");
	});

	// An unregistered context is a wiring mistake, but it must not throw in a change handler — the
	// caller treats null as "nothing to write".
	it("resolves an unregistered context to null", () => {
		const stores = new ChoiceStores().register("arcana", () => ({}));

		expect(stores.resolve(target({ context: "nope" }))).toBeNull();
	});

	it("resolves a missing context to null", () => {
		const stores = new ChoiceStores().register("arcana", () => ({}));

		expect(stores.resolve(target({ context: null }))).toBeNull();
	});

	// The document may be gone (a deleted arcanum, an unknown slug); the host says so by returning null.
	it("resolves to null when the host cannot find the document", () => {
		const stores = new ChoiceStores().register("arcana", () => null);

		expect(stores.resolve(target())).toBeNull();
	});
});
