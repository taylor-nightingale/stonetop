// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { TabViewFlags } from "../../src/utils/TabViewFlags.js";

// Every view-state toggle on a sheet goes through here: it flips the flag the button names, marks
// the button, and asks the sheet to render, since a flag changes what the template emits.

const button = attrs => {
	const el = document.createElement("button");
	for (const [k, v] of Object.entries(attrs)) el.dataset[k] = v;
	document.body.append(el);
	return el;
};

describe("TabViewFlags", () => {
	it("starts the flags it is given as false, and reports them to the context", () => {
		const flags = new TabViewFlags(["levelUpOpen", "railNote"]);
		expect(flags.get("levelUpOpen")).toBe(false);
		expect(flags.toContext()).toEqual({ levelUpOpen: false, railNote: false });
	});

	it("flips a flag and reports the new state", () => {
		const flags = new TabViewFlags(["levelUpOpen"]);
		expect(flags.toggle("levelUpOpen")).toBe(true);
		expect(flags.get("levelUpOpen")).toBe(true);
		expect(flags.toggle("levelUpOpen")).toBe(false);
	});

	it("takes a flag it was never told about", () => {
		const flags = new TabViewFlags();
		expect(flags.toggle("somethingOpen")).toBe(true);
		expect(flags.toContext()).toEqual({ somethingOpen: true });
	});

	it("asks for a render, and marks the button active", () => {
		const flags = new TabViewFlags(["levelUpOpen"]);
		const btn = button({ viewFlag: "levelUpOpen" });

		expect(flags.toggleFrom(btn)).toBe(true);
		expect(btn.classList.contains("is-active")).toBe(true);
		expect(flags.get("levelUpOpen")).toBe(true);

		expect(flags.toggleFrom(btn)).toBe(true);
		expect(btn.classList.contains("is-active")).toBe(false);
	});

	it("ignores a button that names no flag", () => {
		const flags = new TabViewFlags();
		expect(flags.toggleFrom(button({}))).toBe(false);
		expect(flags.toContext()).toEqual({});
	});
});
