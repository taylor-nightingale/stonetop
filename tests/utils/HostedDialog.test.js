import { describe, it, expect, vi, afterEach } from "vitest";
import { HostedDialog } from "../../src/utils/HostedDialog.js";
import { clickedIn } from "../fakes/clickedIn.js";

/** A DialogV2 stand-in that answers `result` and records the config each kind was handed. */
function fakeDialogV2(result = "answer") {
	return {
		confirm: vi.fn(async () => result),
		prompt:  vi.fn(async () => result),
		wait:    vi.fn(async () => result),
	};
}

const host = renderOptions => ({ renderOptions: () => renderOptions });
const popped = { window: { windowId: "stonetop-character-abc" } };

describe("HostedDialog", () => {
	afterEach(() => vi.unstubAllGlobals());

	it.each(["confirm", "prompt", "wait"])("%s opens in the host window", async kind => {
		const DialogV2 = fakeDialogV2();
		await new HostedDialog({ dialogs: () => DialogV2, host: host(popped) })[kind]({ content: "<p>x</p>" });
		expect(DialogV2[kind]).toHaveBeenCalledWith({ content: "<p>x</p>", renderOptions: popped });
	});

	it.each(["confirm", "prompt", "wait"])("%s answers what the dialog answered", async kind => {
		const dialog = new HostedDialog({ dialogs: () => fakeDialogV2(true), host: host({}) });
		expect(await dialog[kind]({})).toBe(true);
	});

	it("keeps render options the caller gave", async () => {
		const DialogV2 = fakeDialogV2();
		await new HostedDialog({ dialogs: () => DialogV2, host: host(popped) })
			.wait({ renderOptions: { position: { width: 500 } } });
		expect(DialogV2.wait.mock.calls[0][0].renderOptions)
			.toEqual({ window: { windowId: "stonetop-character-abc" }, position: { width: 500 } });
	});

	it("reads Foundry's DialogV2 when it opens, not when it is built", async () => {
		const dialog   = new HostedDialog({ host: host({}) });
		const DialogV2 = fakeDialogV2();
		vi.stubGlobal("foundry", { applications: { api: { DialogV2 } } });
		await dialog.confirm({});
		expect(DialogV2.confirm).toHaveBeenCalled();
	});

	it("opens in the popped-out window the player last used, by default", async () => {
		const DialogV2 = fakeDialogV2();
		const win = clickedIn("stonetop-character-abc");
		vi.stubGlobal("foundry", {
			applications: {
				api:      { DialogV2 },
				detached: { windows: new Map([[win.id, { window: win }]]) },
			},
		});
		await new HostedDialog().confirm({});
		expect(DialogV2.confirm.mock.calls[0][0].renderOptions).toEqual(popped);
	});
});
