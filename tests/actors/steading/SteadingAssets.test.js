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

describe("SteadingAssets.buildSnapshot", () => {
	it("returns default coinage when no changes made", () => {
		expect(make().buildSnapshot().coinage).toEqual(DEFAULT_COINAGE);
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

describe("SteadingAssets.updateCoinageEntry", () => {
	it("updates the specified field on an entry", async () => {
		const a = make();
		await a.updateCoinageEntry(0, "purses", 3);
		expect(a.buildSnapshot().coinage[0].purses).toBe(3);
	});

	it("preserves other fields on the same entry", async () => {
		const a = make();
		await a.updateCoinageEntry(0, "purses", 9);
		const entry = a.buildSnapshot().coinage[0];
		expect(entry.purses).toBe(9);
		expect(entry.handfuls).toBe(DEFAULT_COINAGE[0].handfuls);
		expect(entry.coins).toBe(DEFAULT_COINAGE[0].coins);
		expect(entry.title).toBe(DEFAULT_COINAGE[0].title);
	});

	it("can update handfuls and coins independently", async () => {
		const a = make();
		await a.updateCoinageEntry(0, "handfuls", 4);
		await a.updateCoinageEntry(0, "coins", 7);
		const entry = a.buildSnapshot().coinage[0];
		expect(entry.handfuls).toBe(4);
		expect(entry.coins).toBe(7);
	});

	it("multiple field updates accumulate", async () => {
		const a = make();
		await a.updateCoinageEntry(0, "purses", 2);
		await a.updateCoinageEntry(0, "handfuls", 1);
		await a.updateCoinageEntry(0, "coins", 5);
		const entry = a.buildSnapshot().coinage[0];
		expect(entry.purses).toBe(2);
		expect(entry.handfuls).toBe(1);
		expect(entry.coins).toBe(5);
	});
});
