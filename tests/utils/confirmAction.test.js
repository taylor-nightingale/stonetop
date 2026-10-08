import { describe, it, expect, vi, afterEach } from "vitest";
import { confirmAction } from "../../src/utils/confirmAction.js";
import { clickedIn } from "../fakes/clickedIn.js";

function stubFoundry(...detached) {
	const confirm = vi.fn(async () => true);
	vi.stubGlobal("foundry", {
		applications: {
			api:      { DialogV2: { confirm } },
			detached: { windows: new Map(detached.map(win => [win.id, { window: win }])) },
		},
	});
	vi.stubGlobal("game", { i18n: { localize: k => k } });
	return confirm;
}

describe("confirmAction", () => {
	afterEach(() => vi.unstubAllGlobals());

	// Clicked from a popped-out sheet, the question opens beside it rather than back in the main
	// workspace, where nobody looking at the sheet would see it.
	it("asks in the popped-out window the player clicked in", async () => {
		const win     = clickedIn("stonetop-character-abc");
		const confirm = stubFoundry(win);
		await confirmAction("stonetop.inventory.outfit.resetTitle", "body");
		expect(confirm.mock.calls[0][0].renderOptions).toEqual({ window: { windowId: "stonetop-character-abc" } });
	});

	it("asks in the main workspace when the sheet is there", async () => {
		clickedIn(undefined);
		const confirm = stubFoundry({ id: "stonetop-character-abc" });
		await confirmAction("stonetop.inventory.outfit.resetTitle", "body");
		expect(confirm.mock.calls[0][0].renderOptions).toEqual({});
	});
});
