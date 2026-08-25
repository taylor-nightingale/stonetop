// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { renderPartial } from "../fakes/renderTemplate.js";
import { ADVICE_ACTIONS } from "../../src/utils/adviceAction.js";
import { TOPICS_SLUG } from "../../src/model/data/ReferenceTopics.js";
import { Advice } from "../../src/model/data/Advice.js";

// End to end over the real code, with only Foundry mocked: a ? button rendered by the real partial,
// clicked through the real sheet action, resolving against the real journal entry the build wrote,
// and scrolling to its own topic. The unit tests each cover one link in that chain; a wiring mistake
// between them only shows up here.
//
// The advice is a journal page now, not a dialog assembled from strings — one page you scroll — so
// what this asserts is that the button reaches the right ANCHOR, and that the article really carries
// what the book says under that heading.

const entrySource = JSON.parse(readFileSync(
	path.resolve(process.cwd(), "packs/src/reference/if-you-want-to.json"), "utf8"));

const en = JSON.parse(readFileSync(
	path.resolve(process.cwd(), "languages/en.json"), "utf8")).stonetop;

let render;

/** The compendium as Foundry serves it: an index carrying the flags, and the entry behind it. */
beforeEach(() => {
	// The button labels itself from the topic's title, which still ships as a localized string.
	Advice.current = Advice.fromTranslations(en.advice);
	render = vi.fn();
	const entry = {
		pages: entrySource.pages.map(p => ({ id: p._id, name: p.name, flags: p.flags, text: p.text })),
		flags: entrySource.flags,
		sheet: { render },
	};
	// Merge, don't replace: the shared setup already supplies game.i18n, which is what the ? button
	// labels itself through.
	globalThis.game = {
		...(globalThis.game ?? {}),
		packs: {
			get: (name) => (name !== "stonetop.reference" ? null : {
				index: [{ _id: entrySource._id, flags: entrySource.flags }],
				getIndex: async () => {},
				getDocument: async (id) => (id === entrySource._id ? entry : null),
			}),
		},
	};
});

/** The ? button the steading's Prosperity panel renders, as a live element. */
function adviceButton(topic = "prosperity") {
	const host = document.createElement("div");
	host.innerHTML = renderPartial("stonetop.steading-stat-panel", {
		attr: "prosperity", title: "Prosperity", attrData: { options: [] }, advice: topic,
	});
	return host.querySelector("[data-action='showAdvice']");
}

const opened = () => render.mock.calls[0][1];
const article = () => entrySource.pages[0].text.content;

/** The article's text under one heading anchor — what the reader lands on. */
function sectionAt(anchor) {
	const html = article();
	const heads = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)];
	const slug = (h) => h.replace(/<[^>]+>/g, "").replace(/^[…\s.]+/, "").trim()
		.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
	const at = heads.findIndex(h => slug(h[1]) === anchor);
	if (at < 0) return "";
	return html.slice(heads[at].index, at + 1 < heads.length ? heads[at + 1].index : html.length);
}

describe("the ? button on a sheet", () => {
	it("opens the article at the anchor for the topic beside it", async () => {
		expect(await ADVICE_ACTIONS.showAdvice(new Event("click"), adviceButton())).toBe(true);
		expect(render).toHaveBeenCalledOnce();
		expect(render.mock.calls[0][0]).toBe(true);
		expect(opened().pageId).toBe(entrySource.pages[0]._id);
		expect(opened().anchor).toBe("improve-prosperity");
	});

	it("lands where the book actually says what the button asked about", async () => {
		await ADVICE_ACTIONS.showAdvice(new Event("click"), adviceButton());
		const section = sectionAt(opened().anchor);
		expect(section).toContain("Expanded Trades");
		expect(section).toContain("Market");
	});

	// The whole point of linking the names: the advice is a way in to the rules it cites.
	it("leaves the cited moves and improvements as content links", async () => {
		await ADVICE_ACTIONS.showAdvice(new Event("click"), adviceButton());
		expect(sectionAt(opened().anchor)).toContain("@UUID[Compendium.stonetop.steading-improvements.Item.");
	});

	it("reaches a different topic from a different button", async () => {
		await ADVICE_ACTIONS.showAdvice(new Event("click"), adviceButton("defenses"));
		expect(opened().anchor).toBe("improve-defenses");
		expect(sectionAt(opened().anchor)).toContain("Stone Wall");
	});

	// One page you scroll, the way the book sets the spread.
	it("keeps the whole spread on a single page", () => {
		expect(entrySource.pages).toHaveLength(1);
	});

	it("opens nothing when the button names a topic the article has no anchor for", async () => {
		const button = adviceButton();
		button.dataset.topic = "wonders";
		expect(await ADVICE_ACTIONS.showAdvice(new Event("click"), button)).toBe(false);
		expect(render).not.toHaveBeenCalled();
	});

	it("finds the article by its slug flag", () => {
		expect(entrySource.flags.stonetop.slug).toBe(TOPICS_SLUG);
	});
});
