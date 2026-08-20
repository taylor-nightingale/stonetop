// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { TabViewFlags } from "../../src/utils/TabViewFlags.js";

// Every view-state toggle on a sheet goes through here, so the one thing that must not blur is
// which of them re-render: a filter that only hides rows decorates the live tab (rebuilding the
// moves tab mid-review would fight the scroll position), while a toggle that changes the markup
// has to render.

const button = attrs => {
	const el = document.createElement("button");
	for (const [k, v] of Object.entries(attrs)) el.dataset[k] = v;
	document.body.append(el);
	return el;
};

const inTab = (el, ...classes) => {
	const tab = document.createElement("div");
	tab.classList.add("tab", ...classes);
	tab.append(el);
	document.body.append(tab);
	return tab;
};

describe("TabViewFlags", () => {
	it("starts the flags it is given as false, and reports them to the context", () => {
		const flags = new TabViewFlags(["playbookLocked", "hideUnselectedMoves"]);
		expect(flags.get("playbookLocked")).toBe(false);
		expect(flags.toContext()).toEqual({ playbookLocked: false, hideUnselectedMoves: false });
	});

	it("flips a flag and reports the new state", () => {
		const flags = new TabViewFlags(["playbookLocked"]);
		expect(flags.toggle("playbookLocked")).toBe(true);
		expect(flags.get("playbookLocked")).toBe(true);
		expect(flags.toggle("playbookLocked")).toBe(false);
	});

	// Insert tabs name a flag per slug, which nothing can declare up front.
	it("takes a flag it was never told about", () => {
		const flags = new TabViewFlags();
		expect(flags.toggle("insertLocked-invocations")).toBe(true);
		expect(flags.toContext()).toEqual({ "insertLocked-invocations": true });
	});

	it("asks for a render when the button names no class, and marks the button active", () => {
		const flags = new TabViewFlags(["playbookLocked"]);
		const btn = button({ viewFlag: "playbookLocked" });

		expect(flags.toggleFrom(btn)).toBe(true);
		expect(btn.classList.contains("is-active")).toBe(true);
		expect(flags.get("playbookLocked")).toBe(true);

		expect(flags.toggleFrom(btn)).toBe(true);
		expect(btn.classList.contains("is-active")).toBe(false);
	});

	// The cheap path: the class goes on the tab and the sheet is left alone.
	it("decorates the tab in place when the button names a class", () => {
		const flags = new TabViewFlags(["hideUnselectedMoves"]);
		const btn = button({ viewFlag: "hideUnselectedMoves", viewClass: "hide-unselected" });
		const tab = inTab(btn, "moves");

		expect(flags.toggleFrom(btn)).toBe(false);
		expect(tab.classList.contains("hide-unselected")).toBe(true);
		expect(flags.get("hideUnselectedMoves")).toBe(true);

		expect(flags.toggleFrom(btn)).toBe(false);
		expect(tab.classList.contains("hide-unselected")).toBe(false);
	});

	it("ignores a button that names no flag", () => {
		const flags = new TabViewFlags();
		expect(flags.toggleFrom(button({}))).toBe(false);
		expect(flags.toContext()).toEqual({});
	});
});
