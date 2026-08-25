import { describe, it, expect, vi } from "vitest";
import { ReferenceTopics, TOPICS_SLUG } from "../../../src/model/data/ReferenceTopics.js";

// A ? button opens Book I's "If you want to…" article at its own topic. The article is ONE page you
// scroll, so the topic is reached by its heading anchor; the entry is found by its slug flag and the
// anchor read from key → anchor the build stamped on it. Nothing here spells an id out.

const ANCHORS = { fortunes: "increase-fortunes", coin: "get-some-coin" };
const page = (id = "page1") => ({ id });

function storeWith(entry, { indexFlags = { stonetop: { slug: TOPICS_SLUG } } } = {}) {
	return {
		findEntry: vi.fn(async (p) => (p({ _id: "entry1", flags: indexFlags }) ? { _id: "entry1" } : null)),
		getDocument: vi.fn(async () => entry),
	};
}

describe("ReferenceTopics.open", () => {
	it("renders the article at the anchor for that topic", async () => {
		const render = vi.fn();
		const entry = { pages: [page()], flags: { stonetop: { topics: ANCHORS } }, sheet: { render } };

		expect(await new ReferenceTopics(storeWith(entry)).open("coin")).toBe(true);
		expect(render).toHaveBeenCalledWith(true, { pageId: "page1", anchor: "get-some-coin" });
	});

	it("finds the article by its own slug flag, not by an id", async () => {
		const store = storeWith({ pages: [page()], flags: { stonetop: { topics: ANCHORS } }, sheet: { render: vi.fn() } });
		await new ReferenceTopics(store).open("coin");
		// The predicate must reject an entry flagged as something else.
		const [predicate] = store.findEntry.mock.calls[0];
		expect(predicate({ flags: { stonetop: { slug: TOPICS_SLUG } } })).toBe(true);
		expect(predicate({ flags: { stonetop: { slug: "gear-and-possessions" } } })).toBe(false);
		expect(predicate({})).toBeFalsy();
	});

	it("does nothing for a topic the article has no anchor for", async () => {
		const render = vi.fn();
		const store = storeWith({ pages: [page()], flags: { stonetop: { topics: { fortunes: "increase-fortunes" } } }, sheet: { render } });
		expect(await new ReferenceTopics(store).open("coin")).toBe(false);
		expect(render).not.toHaveBeenCalled();
	});

	// A world without the compendium installed should not throw when a button is clicked.
	it("does nothing when the pack has no such entry", async () => {
		const store = { findEntry: vi.fn(async () => null), getDocument: vi.fn() };
		expect(await new ReferenceTopics(store).open("coin")).toBe(false);
		expect(store.getDocument).not.toHaveBeenCalled();
	});

	it("does nothing without a topic key", async () => {
		const store = storeWith({ pages: [page()], flags: { stonetop: { topics: ANCHORS } }, sheet: { render: vi.fn() } });
		expect(await new ReferenceTopics(store).open("")).toBe(false);
		expect(store.findEntry).not.toHaveBeenCalled();
	});
});
