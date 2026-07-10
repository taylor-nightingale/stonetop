import { describe, it, expect } from "vitest";
import { Coinage } from "../../../src/actors/steading/Coinage.js";
import { Currency } from "../../../src/actors/steading/Currency.js";

describe("Coinage.entries", () => {
	it("always returns the full standard set (Silver, Gold) when nothing is stored", () => {
		expect(Coinage.entries([])).toEqual([Currency.of("silver"), Currency.of("gold")]);
	});

	it("defaults to the standard set when no argument is given", () => {
		expect(Coinage.entries()).toEqual([Currency.of("silver"), Currency.of("gold")]);
	});

	it("overlays stored starting values by title", () => {
		const stored = [{ title: "silver", purses: 2, handfuls: 3, coins: 4 }];
		expect(Coinage.entries(stored)).toEqual([
			new Currency("silver", 2, 3, 4),
			Currency.of("gold"),
		]);
	});

	it("emits in standard order regardless of stored order", () => {
		const stored = [
			{ title: "gold", purses: 1, handfuls: 0, coins: 0 },
			{ title: "silver", purses: 5, handfuls: 0, coins: 0 },
		];
		expect(Coinage.entries(stored).map(c => c.title)).toEqual(["silver", "gold"]);
	});

	it("ignores stored currencies outside the standard set", () => {
		const stored = [{ title: "copper", purses: 9, handfuls: 0, coins: 0 }];
		expect(Coinage.entries(stored).map(c => c.title)).toEqual(["silver", "gold"]);
	});
});

describe("Coinage.withUpdated", () => {
	it("creates a stored entry for a standard currency that was absent", () => {
		const next = Coinage.withUpdated([], new Currency("silver", 3, 0, 0));
		expect(next).toEqual([{ title: "silver", purses: 3, handfuls: 0, coins: 0 }]);
	});

	it("replaces the existing entry for a title", () => {
		const stored = [{ title: "silver", purses: 1, handfuls: 1, coins: 1 }];
		const next = Coinage.withUpdated(stored, new Currency("silver", 8, 1, 1));
		expect(next).toEqual([{ title: "silver", purses: 8, handfuls: 1, coins: 1 }]);
	});

	it("leaves other stored currencies untouched", () => {
		const stored = [{ title: "gold", purses: 2, handfuls: 0, coins: 0 }];
		const next = Coinage.withUpdated(stored, new Currency("silver", 4, 0, 0));
		expect(next).toContainEqual({ title: "gold", purses: 2, handfuls: 0, coins: 0 });
		expect(next).toContainEqual({ title: "silver", purses: 4, handfuls: 0, coins: 0 });
	});
});
