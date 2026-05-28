import { describe, it, expect } from "vitest";
import { SteadingAssets } from "../../../module/actors/steading/SteadingAssets.js";
import { SteadingDefaults } from "../../../module/model/data/steading/SteadingDefaults.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";

function make() {
	return new SteadingAssets(new FakeActorBuilder().build());
}

describe("SteadingAssets.buildSnapshot", () => {
	it("returns default coinage when no changes made", () => {
		expect(make().buildSnapshot().coinage).toEqual(SteadingDefaults.assets.coinage);
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
		expect(entry.handfuls).toBe(SteadingDefaults.assets.coinage[0].handfuls);
		expect(entry.coins).toBe(SteadingDefaults.assets.coinage[0].coins);
		expect(entry.title).toBe(SteadingDefaults.assets.coinage[0].title);
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
