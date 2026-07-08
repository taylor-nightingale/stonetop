import { describe, it, expect } from "vitest";
import {SteadingAttributes} from "../../../src/actors/steading/SteadingAttributes.js";
import {FakeSteadingBuilder} from "../../fakes/FakeSteadingBuilder.js";

describe("SteadingAttributes.buildSnapshot", () => {
	it("size has default values", () => {
		const attributes = new SteadingAttributes(new FakeSteadingBuilder().build());
		const snapshot = attributes.buildSnapshot();
		expect(snapshot.size.title).toBe("Size");
		expect(snapshot.size.note.raw).toBe("Starts at <em>village</em>");
		expect(snapshot.size.current).toBe("village");
		expect(snapshot.size.items.length).toBe(0);
		expect(snapshot.size.options.length).toBe(4);
		expect(snapshot.size.options[0].index).toBe(0);
		expect(snapshot.size.options[0].label.raw).toBe("<em>hamlet</em> (&lt;50 people)");
		expect(snapshot.size.options[0].selected).toBe(false);
		expect(snapshot.size.options[1].selected).toBe(true);
	});

	it("population has default values", () => {
		const attributes = new SteadingAttributes(new FakeSteadingBuilder().build());
		const snapshot = attributes.buildSnapshot();
		expect(snapshot.population.title).toBe("Population");
		expect(snapshot.population.note.raw).toBe("Starts at +0");
		expect(snapshot.population.current).toBe(0);
		expect(snapshot.population.items.length).toBe(0);
		expect(snapshot.population.options.length).toBe(5);
		expect(snapshot.population.options[0].index).toBe(0);
		expect(snapshot.population.options[0].label.raw).toBe("-1");
		expect(snapshot.population.options[0].selected).toBe(false);
		expect(snapshot.population.options[1].selected).toBe(true);
	});

	it("prosperity has default values", () => {
		const attributes = new SteadingAttributes(new FakeSteadingBuilder().build());
		const snapshot = attributes.buildSnapshot();
		expect(snapshot.prosperity.title).toBe("Prosperity");
		expect(snapshot.prosperity.note.raw).toBe("Starts at +0");
		expect(snapshot.prosperity.current).toBe(0);
		expect(snapshot.prosperity.items.length).toBe(8);
		expect(snapshot.prosperity.options.length).toBe(5);
		expect(snapshot.prosperity.options[0].index).toBe(0);
		expect(snapshot.prosperity.options[0].label.raw).toBe("-1");
		expect(snapshot.prosperity.options[0].selected).toBe(false);
		expect(snapshot.prosperity.options[1].selected).toBe(true);
	});

	it("defenses has default values", () => {
		const attributes = new SteadingAttributes(new FakeSteadingBuilder().build());
		const snapshot = attributes.buildSnapshot();
		expect(snapshot.defenses.title).toBe("Defenses");
		expect(snapshot.defenses.note.raw).toBe("Starts at +0");
		expect(snapshot.defenses.current).toBe(0);
		expect(snapshot.defenses.items.length).toBe(4);
		expect(snapshot.defenses.options.length).toBe(5);
		expect(snapshot.defenses.options[0].index).toBe(0);
		expect(snapshot.defenses.options[0].label.raw).toBe("-1 <em>feeble</em>");
		expect(snapshot.defenses.options[0].selected).toBe(false);
		expect(snapshot.defenses.options[1].selected).toBe(true);
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
