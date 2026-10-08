import { describe, expect, it } from "vitest";
import { RollModes, RollModeOption } from "../../src/actors/RollModes.js";

describe("RollModes.options", () => {
	it("offers the three modes, advantage first", () => {
		expect(RollModes.options().map(o => o.key)).toEqual(["adv", "normal", "dis"]);
	});

	it("carries a label key per mode, for the dialog to localize", () => {
		expect(RollModes.options().map(o => o.labelKey))
			.toEqual(["stonetop.rollMode.adv", "stonetop.rollMode.normal", "stonetop.rollMode.dis"]);
	});

	it("returns typed options, not anonymous bags", () => {
		expect(RollModes.options()[0]).toBeInstanceOf(RollModeOption);
	});
});
