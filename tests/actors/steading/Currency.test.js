import { describe, it, expect } from "vitest";
import { Currency } from "../../../src/actors/steading/Currency.js";

describe("Currency.of", () => {
	it("creates a zeroed currency for the given title", () => {
		expect(Currency.of("silver")).toEqual(new Currency("silver", 0, 0, 0));
	});
});

// A currency's displayed name is authored copy, not a capitalization of the stored slug: "Silver"
// built in JavaScript is a string no translator can reach, and the sheet says it out loud twice.
describe("Currency.labelKey", () => {
	it("names the i18n key for the currency", () => {
		expect(Currency.of("silver").labelKey).toBe("stonetop.steading.coinage.silver");
		expect(Currency.of("gold").labelKey).toBe("stonetop.steading.coinage.gold");
	});

	// Never reached through Coinage, whose standard set is fixed — but a key ending in a dot is one
	// Foundry answers with the key itself, which would print the whole path on the sheet.
	it("is empty for an empty title, rather than a key with nothing on the end", () => {
		expect(Currency.of("").labelKey).toBe("");
	});

	it("is not carried into a with-update's new instance as a stored field", () => {
		expect(Currency.of("silver").withPurses(2).toJSON())
			.toEqual({ title: "silver", purses: 2, handfuls: 0, coins: 0 });
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
	it("serializes the stored fields without the derived label key", () => {
		expect(new Currency("silver", 1, 2, 3).toJSON())
			.toEqual({ title: "silver", purses: 1, handfuls: 2, coins: 3 });
	});
});
