import { describe, it, expect, vi } from "vitest";
import { AdviceDialog } from "../../src/utils/AdviceDialog.js";
import { Advice } from "../../src/model/data/Advice.js";

const ADVICE = Advice.fromTranslations({
	fortunes: {
		title: "increase Fortunes",
		blocks: [{ type: "list", items: ["@UUID[Compendium.stonetop.moves.Item.abc]{Return Triumphant}."] }],
	},
});

function makeDialog({ advice = ADVICE, prompt = vi.fn(async () => null) } = {}) {
	const renderTemplate = vi.fn(async () => "<div class=\"stonetop-advice\"></div>");
	const enrich = vi.fn(async snapshot => snapshot);
	const dialog = new AdviceDialog({
		advice: () => advice,
		renderTemplate,
		prompt,
		localize: key => key,
		format: (key, data) => `${key}:${data.topic}`,
		enrich,
	});
	return { dialog, renderTemplate, prompt, enrich };
}

describe("AdviceDialog", () => {
	it("shows the advice for the topic the button named", async () => {
		const { dialog, prompt } = makeDialog();
		expect(await dialog.show("fortunes")).toBe(true);
		expect(prompt).toHaveBeenCalledOnce();
	});

	it("titles the window with the book's own heading", async () => {
		const { dialog, prompt } = makeDialog();
		await dialog.show("fortunes");
		expect(prompt.mock.calls[0][0].window.title).toBe("stonetop.sheet.advice.label:increase Fortunes");
	});

	it("renders the topic's blocks into the dialog body", async () => {
		const { dialog, renderTemplate } = makeDialog();
		await dialog.show("fortunes");
		const [path, data] = renderTemplate.mock.calls[0];
		expect(path).toContain("templates/apps/advice.hbs");
		expect(data.advice.title).toBe("increase Fortunes");
		expect(data.advice.blocks[0].items).toHaveLength(1);
	});

	// The @UUID tokens are only clickable once enriched, so this has to happen before the render.
	it("enriches the snapshot before rendering it", async () => {
		const { dialog, enrich, renderTemplate } = makeDialog();
		await dialog.show("fortunes");
		expect(enrich).toHaveBeenCalledOnce();
		expect(enrich.mock.invocationCallOrder[0]).toBeLessThan(renderTemplate.mock.invocationCallOrder[0]);
	});

	// A sheet asking about a topic the language file has no entry for is a no-op, not an error.
	it("opens nothing for an unknown topic", async () => {
		const { dialog, prompt, renderTemplate } = makeDialog();
		expect(await dialog.show("nope")).toBe(false);
		expect(prompt).not.toHaveBeenCalled();
		expect(renderTemplate).not.toHaveBeenCalled();
	});

	// The advice only lands at i18nInit, so the dialog must read it when it is opened.
	it("reads the advice at show time, not at construction", async () => {
		const advice = { current: new Advice() };
		const dialog = new AdviceDialog({
			advice: () => advice.current,
			renderTemplate: vi.fn(async () => ""),
			prompt: vi.fn(async () => null),
			localize: key => key,
			format: key => key,
			enrich: async s => s,
		});
		expect(await dialog.show("fortunes")).toBe(false);
		advice.current = ADVICE;
		expect(await dialog.show("fortunes")).toBe(true);
	});

	it("is dismissable — the player is reading, not answering", async () => {
		const { dialog, prompt } = makeDialog();
		await dialog.show("fortunes");
		expect(prompt.mock.calls[0][0].rejectClose).toBe(false);
	});
});
