import { describe, it, expect, vi, afterEach } from "vitest";
import { confirmAction } from "../../src/utils/confirmAction.js";

function stubFoundry() {
	const confirm = vi.fn(async () => true);
	vi.stubGlobal("foundry", { applications: { api: { DialogV2: { confirm } } } });
	vi.stubGlobal("game", { i18n: { localize: k => k } });
	return confirm;
}

describe("confirmAction", () => {
	afterEach(() => vi.unstubAllGlobals());

	// Asked from a popped-out sheet, the question opens over it rather than back in the main
	// workspace, where nobody looking at the sheet would see it.
	it("asks in the window of the sheet that asked", async () => {
		const confirm = stubFoundry();
		const sheet   = { window: { windowId: "stonetop-character-abc" } };
		await confirmAction("stonetop.inventory.outfit.resetTitle", "body", sheet);
		expect(confirm.mock.calls[0][0].renderOptions).toEqual({ window: { windowId: "stonetop-character-abc" } });
	});

	it("asks in the main workspace when the sheet is there", async () => {
		const confirm = stubFoundry();
		await confirmAction("stonetop.inventory.outfit.resetTitle", "body", { window: {} });
		expect(confirm.mock.calls[0][0].renderOptions).toEqual({});
	});
});
