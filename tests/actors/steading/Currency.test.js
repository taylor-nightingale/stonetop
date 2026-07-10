import { describe, it, expect } from "vitest";
import { Currency } from "../../../src/actors/steading/Currency.js";

describe("Currency.of", () => {
	it("creates a zeroed currency for the given title", () => {
		expect(Currency.of("silver")).toEqual(new Currency("silver", 0, 0, 0));
	});
});

describe("Currency.label", () => {
	it("capitalizes the title for display", () => {
		expect(Currency.of("silver").label).toBe("Silver");
		expect(Currency.of("gold").label).toBe("Gold");
	});

	it("is empty for an empty title", () => {
		expect(Currency.of("").label).toBe("");
	});
});

describe("Currency with-methods", () => {
	it("withPurses returns a new instance with purses changed", () => {
		const base = new Currency("silver", 1, 2, 3);
		const next = base.withPurses(9);
		expect(next.purses).toBe(9);
		expect(next).not.toBe(base);
		expect(base.purses).toBe(1);
	});

	it("withHandfuls changes only handfuls", () => {
		const next = new Currency("gold", 1, 2, 3).withHandfuls(7);
		expect(next).toEqual(new Currency("gold", 1, 7, 3));
	});

	it("withCoins changes only coins", () => {
		const next = new Currency("gold", 1, 2, 3).withCoins(5);
		expect(next).toEqual(new Currency("gold", 1, 2, 5));
	});
});

describe("Currency.fromRaw", () => {
	it("reads all fields", () => {
		expect(Currency.fromRaw({ title: "gold", purses: 4, handfuls: 5, coins: 6 }))
			.toEqual(new Currency("gold", 4, 5, 6));
	});

	it("defaults missing counts to zero", () => {
		expect(Currency.fromRaw({ title: "silver" })).toEqual(new Currency("silver", 0, 0, 0));
	});
});

describe("Currency.toJSON", () => {
	it("serializes the stored fields without the derived label", () => {
		expect(new Currency("silver", 1, 2, 3).toJSON())
			.toEqual({ title: "silver", purses: 1, handfuls: 2, coins: 3 });
	});
});
