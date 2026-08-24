import { describe, expect, it } from "vitest";
import { RollOutcome } from "../../src/actors/RollOutcome.js";

const outcome = total => RollOutcome.fromTotal(total, k => k);

describe("RollOutcome.fromTotal", () => {
	it("10+ is a strong hit", () => {
		expect(outcome(10).key).toBe("success");
		expect(outcome(10).label).toBe("stonetop.rollResults.strongHit");
	});

	it("7-9 is a weak hit", () => {
		expect(outcome(7).key).toBe("partial");
		expect(outcome(9).key).toBe("partial");
		expect(outcome(7).label).toBe("stonetop.rollResults.weakHit");
	});

	it("6- is a miss", () => {
		expect(outcome(6).key).toBe("failure");
		expect(outcome(6).label).toBe("stonetop.rollResults.miss");
	});

	it("stays a miss for a total driven below the dice range by a penalty", () => {
		expect(outcome(-1).key).toBe("failure");
	});

	it("stays a strong hit for a total above the dice range", () => {
		expect(outcome(14).key).toBe("success");
	});
});

describe("RollOutcome.isMiss", () => {
	it("is true only for the failure tier", () => {
		expect(outcome(6).isMiss).toBe(true);
		expect(outcome(7).isMiss).toBe(false);
		expect(outcome(10).isMiss).toBe(false);
	});
});
