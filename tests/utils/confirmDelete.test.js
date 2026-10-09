import { describe, it, expect, vi, afterEach } from "vitest";
import { confirmDelete } from "../../src/utils/confirmDelete.js";

function stubFoundry(confirmResult) {
	const confirm = vi.fn(async () => confirmResult);
	vi.stubGlobal("foundry", {
		...globalThis.foundry,
		applications: {
			...globalThis.foundry?.applications,
			api: { DialogV2: { confirm } },
		},
	});
	vi.stubGlobal("game", {
		i18n: {
			localize: k => k,
			format: (k, data) => `${k}:${data.name}`,
		},
	});
	return confirm;
}

describe("confirmDelete", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("resolves true when the dialog is confirmed", async () => {
		stubFoundry(true);
		expect(await confirmDelete("Cloak")).toBe(true);
	});

	it("resolves false when the dialog is declined", async () => {
		stubFoundry(false);
		expect(await confirmDelete("Cloak")).toBe(false);
	});

	it("resolves false when the dialog is dismissed (DialogV2 resolves undefined)", async () => {
		stubFoundry(undefined);
		expect(await confirmDelete("Cloak")).toBe(false);
	});

	it("shows the item name in the prompt and the localized title", async () => {
		const confirm = stubFoundry(true);
		await confirmDelete("Cloak");
		const cfg = confirm.mock.calls[0][0];
		expect(cfg.content).toContain("Cloak");
		expect(cfg.window.title).toBe("stonetop.confirm.deleteTitle");
	});

	it("uses the generic prompt when no name is given", async () => {
		const confirm = stubFoundry(true);
		await confirmDelete();
		expect(confirm.mock.calls[0][0].content).toContain("stonetop.confirm.deleteGeneric");
	});

	it("HTML-escapes the name to avoid markup injection", async () => {
		const confirm = stubFoundry(true);
		await confirmDelete("<b>x</b>");
		expect(confirm.mock.calls[0][0].content).toContain("&lt;b&gt;x&lt;/b&gt;");
	});

	it("asks in the window of the sheet that asked", async () => {
		const confirm = stubFoundry(true);
		await confirmDelete("Cloak", { window: { windowId: "stonetop-character-abc" } });
		expect(confirm.mock.calls[0][0].renderOptions).toEqual({ window: { windowId: "stonetop-character-abc" } });
	});
});
