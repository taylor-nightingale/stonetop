import { describe, it, expect } from "vitest";
import {SteadingAttributes} from "../../../src/actors/steading/SteadingAttributes.js";
import {FakeSteadingBuilder} from "../../fakes/FakeSteadingBuilder.js";

describe("SteadingAttributes.buildSnapshot", () => {
	it("size is a named rating, picked from its tiers", () => {
		const attributes = new SteadingAttributes(new FakeSteadingBuilder().build());
		const snapshot = attributes.buildSnapshot();
		expect(snapshot.size.title).toBe("stonetop.steading.attr.size");
		expect(snapshot.size.current).toBe("village");
		expect(snapshot.size.tierLabel).toBe("stonetop.steading.tier.size.village");
		expect(snapshot.size.band).toBe("stonetop.steading.band.village");
		expect(snapshot.size.isNumeric).toBe(false);
		expect(snapshot.size.items.length).toBe(0);
		expect(snapshot.size.options.length).toBe(4);
		expect(snapshot.size.options[0].selected).toBe(false);
		expect(snapshot.size.options[1].selected).toBe(true);
	});

	it("population is a numeric rating with no tier word", () => {
		const attributes = new SteadingAttributes(new FakeSteadingBuilder().build());
		const snapshot = attributes.buildSnapshot();
		expect(snapshot.population.title).toBe("stonetop.steading.attr.population");
		expect(snapshot.population.current).toBe(0);
		expect(snapshot.population.isNumeric).toBe(true);
		expect(snapshot.population.min).toBe(-1);
		expect(snapshot.population.max).toBe(3);
		expect(snapshot.population.tierLabel).toBe("");
		expect(snapshot.population.items.length).toBe(0);
		expect(snapshot.population.options).toEqual([]);
	});

	it("prosperity carries the resources backing it", () => {
		const attributes = new SteadingAttributes(new FakeSteadingBuilder().build());
		const snapshot = attributes.buildSnapshot();
		expect(snapshot.prosperity.title).toBe("stonetop.steading.attr.prosperity");
		expect(snapshot.prosperity.current).toBe(0);
		expect(snapshot.prosperity.items.length).toBe(8);
	});

	it("defenses names the book's tier word for its current value", () => {
		const attributes = new SteadingAttributes(new FakeSteadingBuilder().build());
		const snapshot = attributes.buildSnapshot();
		expect(snapshot.defenses.title).toBe("stonetop.steading.attr.defenses");
		expect(snapshot.defenses.current).toBe(0);
		expect(snapshot.defenses.tierLabel).toBe("stonetop.steading.tier.defenses.mediocre");
		expect(snapshot.defenses.items.length).toBe(4);
	});

	it("names the debility bending a rating, and leaves the others unmarked", () => {
		const actor = new FakeSteadingBuilder().build();
		const rolls = { adjustmentFor: slug => (slug === "prosperity" ? { delta: -1, debility: "lacking" } : null) };
		const snapshot = new SteadingAttributes(actor, rolls).buildSnapshot();
		// Prosperity is 0 in the fixture, so lacking leaves −1 to roll.
		expect(snapshot.prosperity.adjustment).toBe("→ −1 stonetop.steading.debilities.lacking.name");
		expect(snapshot.defenses.adjustment).toBe("");
	});

	it("says nothing about adjustments when no rolls collaborator is supplied", () => {
		const snapshot = new SteadingAttributes(new FakeSteadingBuilder().build()).buildSnapshot();
		expect(snapshot.prosperity.adjustment).toBe("");
	});

	it("can add new blank items", async () => {
		const attributes = new SteadingAttributes(new FakeSteadingBuilder().build());
		await attributes.addNewItemToAttribute("defenses");
		const snapshot = attributes.buildSnapshot();
		expect(snapshot.defenses.items.length).toBe(5);
		expect(snapshot.defenses.items[4]).toBe("");
	});

	it("can remove items", async () => {
		const attributes = new SteadingAttributes(new FakeSteadingBuilder().build());
		let snapshot = attributes.buildSnapshot();
		expect(snapshot.defenses.items.length).toBe(4);
		expect(snapshot.defenses.items[1]).toBe("The Ringwall (low, stone)");

		await attributes.removeItemFromAttribute("defenses", 1);

		snapshot = attributes.buildSnapshot();
		expect(snapshot.defenses.items.length).toBe(3);
		expect(snapshot.defenses.items[1]).toBe("3 watchtowers");
	});

	it("can update items", async () => {
		const attributes = new SteadingAttributes(new FakeSteadingBuilder().build());
		let snapshot = attributes.buildSnapshot();
		expect(snapshot.defenses.items.length).toBe(4);
		expect(snapshot.defenses.items[1]).toBe("The Ringwall (low, stone)");

		await attributes.updateItemOnAttribute("defenses", 1, "new value");

		snapshot = attributes.buildSnapshot();
		expect(snapshot.defenses.items.length).toBe(4);
		expect(snapshot.defenses.items[1]).toBe("new value");
	});
});
