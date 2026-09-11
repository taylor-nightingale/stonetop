import { describe, it, expect } from "vitest";
import { SeasonStepAddress } from "../../src/model/data/steading/SeasonStepAddress.js";

// Winter rolls 1d4+Population twice — once as its opening step, and again on a 7-9 or a 6- — and
// both move Surplus, so each needs a record of its own that can be undone on its own. This is what
// tells the two apart, in the store and on the control.

describe("SeasonStepAddress", () => {
	it("addresses a step by its index, and a result row by its tier", () => {
		expect(SeasonStepAddress.of(0).key).toBe("0");
		expect(SeasonStepAddress.of(3, "partial").key).toBe("3:partial");
		expect(SeasonStepAddress.of(3, "partial").isTier).toBe(true);
		expect(SeasonStepAddress.of(3).isTier).toBe(false);
	});

	// A record written before results could roll is keyed by a plain index, and is still addressed by
	// the address it was stored under.
	it("writes a step's key exactly as it was always written", () => {
		expect(SeasonStepAddress.parse("2").key).toBe("2");
		expect(SeasonStepAddress.parse(2).key).toBe("2");
	});

	it("reads back what a control carries", () => {
		expect(SeasonStepAddress.parse("3:failure")).toEqual(SeasonStepAddress.of(3, "failure"));
	});

	it("takes an address it is handed unchanged", () => {
		const address = SeasonStepAddress.of(1, "success");
		expect(SeasonStepAddress.parse(address)).toBe(address);
	});

	// Anything that is not an address is none, rather than an address to somewhere else: a button
	// whose dataset went missing would otherwise roll step 0 — winter's whole consumption.
	it.each([["", "an empty dataset"], ["x", "a name"], ["1.5", "a fraction"], ["-1", "a negative"],
		["0:", "a blank tier"], ["0:mild", "a tier the move has no such thing as"],
		["0:partial:1", "a key with more parts than an address has"], [null, "nothing at all"]])(
		"refuses %s (%s)", raw => {
			expect(SeasonStepAddress.parse(raw)).toBeNull();
		});

	it("refuses to be built out of one either", () => {
		expect(SeasonStepAddress.of(1.5)).toBeNull();
		expect(SeasonStepAddress.of(-1)).toBeNull();
		expect(SeasonStepAddress.of(0, "mild")).toBeNull();
	});
});
