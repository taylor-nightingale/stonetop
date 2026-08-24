import { describe, expect, it } from "vitest";
import { RollModes, RollModeOption } from "../../src/actors/RollModes.js";

describe("RollModes.options", () => {
	it("offers the three modes, advantage first", () => {
		expect(RollModes.options().map(o => o.key)).toEqual(["adv", "normal", "dis"]);
	});

	it("carries a label key per mode, for the template to localize", () => {
		expect(RollModes.options().map(o => o.labelKey))
			.toEqual(["stonetop.rollMode.adv", "stonetop.rollMode.normal", "stonetop.rollMode.dis"]);
	});

	it("ticks the selected mode and nothing else", () => {
		const ticked = RollModes.options("dis").filter(o => o.checked);
		expect(ticked.map(o => o.key)).toEqual(["dis"]);
	});

	it("defaults to ticking normal", () => {
		expect(RollModes.options().find(o => o.checked).key).toBe("normal");
	});

	it("ticks nothing for a mode it does not offer, rather than guessing one", () => {
		expect(RollModes.options("bogus").some(o => o.checked)).toBe(false);
	});

	it("returns typed options, not anonymous bags", () => {
		expect(RollModes.options()[0]).toBeInstanceOf(RollModeOption);
	});

	it("hands out a fresh list each call, so a caller cannot tick a shared one", () => {
		const first = RollModes.options("adv");
		first[0].checked = false;
		expect(RollModes.options("adv")[0].checked).toBe(true);
	});
});
