import { describe, it, expect } from "vitest";
import { inWindowOf } from "../../src/utils/inWindowOf.js";

describe("inWindowOf", () => {
	it("opens in the popped-out window the app is in", () => {
		const sheet = { window: { windowId: "stonetop-character-abc" } };
		expect(inWindowOf(sheet)).toEqual({ window: { windowId: "stonetop-character-abc" } });
	});

	it("leaves the window to Foundry when the app is in the main workspace", () => {
		expect(inWindowOf({ window: { windowId: undefined } })).toEqual({});
	});

	// v13's ApplicationV2 has no windowId, and a roll asked from chat or a macro has no sheet at all.
	it("leaves the window to Foundry when there is no window to follow", () => {
		expect(inWindowOf({ window: {} })).toEqual({});
		expect(inWindowOf(undefined)).toEqual({});
	});
});
