// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { renderTemplate, renderPartial } from "../fakes/renderTemplate.js";
import { ADVICE_ACTIONS } from "../../src/utils/adviceAction.js";
import { Advice } from "../../src/model/data/Advice.js";

// End to end over the real code, with only Foundry mocked: a ? button rendered by the real partial,
// clicked through the real sheet action, into the real dialog, reading the real advice out of
// languages/en.json and rendering it through the real template. The unit tests each cover one link
// in that chain; a wiring mistake between them only shows up here.

const en = JSON.parse(readFileSync(path.resolve(process.cwd(), "languages/en.json"), "utf8")).stonetop;

let prompt;
let previousAdvice;

beforeEach(() => {
	previousAdvice = Advice.current;
	Advice.current = Advice.fromTranslations(en.advice);
	prompt = vi.fn(async () => null);
	foundry.applications.handlebars.renderTemplate = renderTemplate;
	foundry.applications.api = { DialogV2: { prompt } };
});

afterEach(() => {
	Advice.current = previousAdvice;
	foundry.applications.handlebars.renderTemplate = async () => "";
	delete foundry.applications.api;
});

/** The ? button the steading's Prosperity panel renders, as a live element. */
function adviceButton(topic = "prosperity") {
	const host = document.createElement("div");
	host.innerHTML = renderPartial("stonetop.steading-stat-panel", {
		attr: "prosperity", title: "Prosperity", attrData: { options: [] },
		advice: topic,
	});
	return host.querySelector("[data-action='showAdvice']");
}

const shown = () => prompt.mock.calls[0][0];

describe("the ? button on a sheet", () => {
	it("opens the advice for the topic beside it", async () => {
		await ADVICE_ACTIONS.showAdvice(new Event("click"), adviceButton());
		expect(prompt).toHaveBeenCalledOnce();
		expect(shown().window.title).toBe("If you want to… improve Prosperity");
	});

	it("shows what the book actually says", async () => {
		await ADVICE_ACTIONS.showAdvice(new Event("click"), adviceButton());
		expect(shown().content).toContain("Expanded Trades");
		expect(shown().content).toContain("Market");
	});

	// The whole point of linking the names: the advice is a way in to the rules it cites.
	it("leaves the cited moves and improvements as content links", async () => {
		await ADVICE_ACTIONS.showAdvice(new Event("click"), adviceButton());
		expect(shown().content).toContain("@UUID[Compendium.stonetop.steading-improvements.Item.");
	});

	it("renders a bulleted topic as a list", async () => {
		await ADVICE_ACTIONS.showAdvice(new Event("click"), adviceButton("defenses"));
		expect(shown().content).toContain("<ul class=\"stonetop-advice-options\">");
		expect(shown().content).toContain("Stone Wall");
	});

	it("opens nothing when the button names a topic the book has no advice for", async () => {
		const button = adviceButton();
		button.dataset.topic = "wonders";
		expect(await ADVICE_ACTIONS.showAdvice(new Event("click"), button)).toBe(false);
		expect(prompt).not.toHaveBeenCalled();
	});
});
