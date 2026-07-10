import { describe, it, expect } from "vitest";
import { SteadingAssets } from "../../../src/actors/steading/SteadingAssets.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";

const DEFAULT_ITEMS_COUNT = 4;
const DEFAULT_COINAGE = [
	{ title: "silver", purses: 0, handfuls: 0, coins: 0 },
	{ title: "gold",   purses: 0, handfuls: 0, coins: 0 },
];

function make() {
	return new SteadingAssets(new FakeSteadingBuilder().build());
}

// A SteadingAssets over an actor whose stored coinage is empty (as every steadfast but Stonetop is).
function makeWithEmptyCoinage() {
	const actor = new FakeSteadingBuilder().build();
	actor.system.assets.coinage = [];
	return new SteadingAssets(actor);
}

describe("SteadingAssets.buildSnapshot", () => {
	it("returns default coinage when no changes made", () => {
		expect(make().buildSnapshot().coinage).toEqual(DEFAULT_COINAGE);
	});

	it("still shows the standard currencies when stored coinage is empty", () => {
		expect(makeWithEmptyCoinage().buildSnapshot().coinage).toEqual(DEFAULT_COINAGE);
	});

	it("returns default items when no changes made", () => {
		expect(make().buildSnapshot().items).toHaveLength(DEFAULT_ITEMS_COUNT);
	});
});

describe("SteadingAssets.addItem", () => {
	it("appends a blank item to the list", async () => {
		const a = make();
		await a.addItem();
		const items = a.buildSnapshot().items;
		expect(items).toHaveLength(DEFAULT_ITEMS_COUNT + 1);
		expect(items.at(-1)).toBe("");
	});

	it("preserves existing items", async () => {
		const a = make();
		const before = a.buildSnapshot().items;
		await a.addItem();
		expect(a.buildSnapshot().items.slice(0, -1)).toEqual(before);
	});
});

describe("SteadingAssets.removeItem", () => {
	it("removes the item at the given index", async () => {
		const a = make();
		const before = a.buildSnapshot().items;
		await a.removeItem(0);
		expect(a.buildSnapshot().items).toEqual(before.slice(1));
	});

	it("removes from the middle without affecting other items", async () => {
		const a = make();
		const before = a.buildSnapshot().items;
		await a.removeItem(1);
		const after = a.buildSnapshot().items;
		expect(after).toHaveLength(before.length - 1);
		expect(after[0]).toBe(before[0]);
		expect(after[1]).toBe(before[2]);
	});
});

describe("SteadingAssets.updateItem", () => {
	it("updates the value at the given index", async () => {
		const a = make();
		await a.updateItem(0, "A new thing");
		expect(a.buildSnapshot().items[0]).toBe("A new thing");
	});

	it("does not affect other items", async () => {
		const a = make();
		const before = a.buildSnapshot().items;
		await a.updateItem(2, "Changed");
		const after = a.buildSnapshot().items;
		expect(after[0]).toBe(before[0]);
		expect(after[1]).toBe(before[1]);
		expect(after[2]).toBe("Changed");
		expect(after[3]).toBe(before[3]);
	});
});

function silver(assets) {
	return assets.buildSnapshot().coinage.find(c => c.title === "silver");
}

describe("SteadingAssets currency updates", () => {
	it("updatePurses sets purses on the named currency", async () => {
		const a = make();
		await a.updatePurses("silver", 3);
		expect(silver(a).purses).toBe(3);
	});

	it("preserves the currency's other fields", async () => {
		const a = make();
		await a.updatePurses("silver", 9);
		const entry = silver(a);
		expect(entry.purses).toBe(9);
		expect(entry.handfuls).toBe(DEFAULT_COINAGE[0].handfuls);
		expect(entry.coins).toBe(DEFAULT_COINAGE[0].coins);
		expect(entry.title).toBe(DEFAULT_COINAGE[0].title);
	});

	it("updateHandfuls and updateCoins update independently", async () => {
		const a = make();
		await a.updateHandfuls("silver", 4);
		await a.updateCoins("silver", 7);
		const entry = silver(a);
		expect(entry.handfuls).toBe(4);
		expect(entry.coins).toBe(7);
	});

	it("multiple field updates accumulate", async () => {
		const a = make();
		await a.updatePurses("silver", 2);
		await a.updateHandfuls("silver", 1);
		await a.updateCoins("silver", 5);
		const entry = silver(a);
		expect(entry.purses).toBe(2);
		expect(entry.handfuls).toBe(1);
		expect(entry.coins).toBe(5);
	});

	it("does not touch the other currency", async () => {
		const a = make();
		await a.updatePurses("silver", 6);
		expect(a.buildSnapshot().coinage.find(c => c.title === "gold")).toEqual(DEFAULT_COINAGE[1]);
	});

	it("creates the entry when editing a standard currency absent from storage", async () => {
		const a = makeWithEmptyCoinage();
		await a.updatePurses("gold", 5);
		expect(silver(a)).toEqual(DEFAULT_COINAGE[0]);
		expect(a.buildSnapshot().coinage.find(c => c.title === "gold").purses).toBe(5);
	});
});
