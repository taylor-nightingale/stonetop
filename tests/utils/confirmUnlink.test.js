import { describe, it, expect, vi, afterEach } from "vitest";
import { confirmUnlink } from "../../src/utils/confirmUnlink.js";

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

describe("confirmUnlink", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("resolves true when the dialog is confirmed", async () => {
		stubFoundry(true);
		expect(await confirmUnlink("Cerdig")).toBe(true);
	});

	it("resolves false when the dialog is declined", async () => {
		stubFoundry(false);
		expect(await confirmUnlink("Cerdig")).toBe(false);
	});

	it("resolves false when the dialog is dismissed (DialogV2 resolves undefined)", async () => {
		stubFoundry(undefined);
		expect(await confirmUnlink("Cerdig")).toBe(false);
	});

	it("shows the row name in the prompt and the localized title", async () => {
		const confirm = stubFoundry(true);
		await confirmUnlink("Cerdig");
		const cfg = confirm.mock.calls[0][0];
		expect(cfg.content).toContain("Cerdig");
		expect(cfg.window.title).toBe("stonetop.confirm.unlinkTitle");
	});

	it("uses the generic prompt when no name is given", async () => {
		const confirm = stubFoundry(true);
		await confirmUnlink();
		expect(confirm.mock.calls[0][0].content).toContain("stonetop.confirm.unlinkGeneric");
	});

	// A resident row's name is player-authored, so it reaches the dialog as text, never as markup.
	it("HTML-escapes the name to avoid markup injection", async () => {
		const confirm = stubFoundry(true);
		await confirmUnlink("<b>x</b>");
		expect(confirm.mock.calls[0][0].content).toContain("&lt;b&gt;x&lt;/b&gt;");
	});

	it("asks with its own wording, not the delete prompt", async () => {
		const confirm = stubFoundry(true);
		await confirmUnlink("Cerdig");
		expect(confirm.mock.calls[0][0].content).not.toContain("delete");
	});
});
