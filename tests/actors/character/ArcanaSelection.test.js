// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ArcanaSelection } from "../../../src/actors/character/ArcanaSelection.js";

// Which arcanum this sheet's reader has open beside the list. Sheet-instance state: every tick on a
// card re-renders the sheet, and the card being read has to survive that.

const mount = (...slugs) => {
	document.body.innerHTML = `<form id="root">
		<div class="stonetop-arcana-list">${slugs.map(s => `<button class="stonetop-arcana-pick" data-slug="${s}">${s}</button>`).join("")}</div>
		<div class="stonetop-arcana-reader">${slugs.map(s => `<div class="stonetop-arcanum-card" data-slug="${s}"></div>`).join("")}</div>
	</form>`;
	return document.getElementById("root");
};
const shown = root => [...root.querySelectorAll(".stonetop-arcanum-card")].filter(c => !c.hidden).map(c => c.dataset.slug);
const current = root => [...root.querySelectorAll(".stonetop-arcana-pick")]
	.filter(b => b.getAttribute("aria-current") === "true").map(b => b.dataset.slug);

beforeEach(() => { document.body.innerHTML = ""; });

describe("ArcanaSelection.restore", () => {
	it("shows the first card when the reader has chosen none", () => {
		const root = mount("mindgem", "satchel", "key");
		new ArcanaSelection().restore(root);
		expect(shown(root)).toEqual(["mindgem"]);
	});

	it("shows the card that was chosen, and only that card", () => {
		const selection = new ArcanaSelection();
		selection.select("satchel");
		const root = mount("mindgem", "satchel", "key");
		selection.restore(root);
		expect(shown(root)).toEqual(["satchel"]);
	});

	it("marks the shown card's line in the list as the current one", () => {
		const selection = new ArcanaSelection();
		selection.select("key");
		const root = mount("mindgem", "satchel", "key");
		selection.restore(root);
		expect(current(root)).toEqual(["key"]);
		expect(root.querySelector('[data-slug="mindgem"].stonetop-arcana-pick').getAttribute("aria-current")).toBe("false");
	});

	// The chosen card was removed: the reader lands on the first, rather than on nothing.
	it("falls back to the first card when the chosen one is gone", () => {
		const selection = new ArcanaSelection();
		selection.select("satchel");
		const root = mount("mindgem", "key");
		selection.restore(root);
		expect(shown(root)).toEqual(["mindgem"]);
	});

	// A dropped arcanum is chosen before it exists; the render that adds it is the one that shows it.
	it("shows a card chosen before it was drawn, once it is", () => {
		const selection = new ArcanaSelection();
		selection.select("crown");
		selection.restore(mount("mindgem"));
		const root = mount("mindgem", "crown");
		selection.restore(root);
		expect(shown(root)).toEqual(["crown"]);
	});

	// The item sheet draws the same card partial as a preview, outside any reader.
	it("leaves cards outside the reader alone", () => {
		const root = mount("mindgem", "satchel");
		root.insertAdjacentHTML("beforeend", '<div class="stonetop-arcanum-card" data-slug="preview"></div>');
		new ArcanaSelection().restore(root);
		expect(root.querySelector('[data-slug="preview"]').hidden).toBe(false);
	});

	it("does nothing to a tree with no arcana", () => {
		document.body.innerHTML = '<form id="root"><p>empty</p></form>';
		expect(() => new ArcanaSelection().restore(document.getElementById("root"))).not.toThrow();
	});
});

describe("ArcanaSelection.choose", () => {
	it("shows the chosen card without a render", () => {
		const root = mount("mindgem", "satchel");
		new ArcanaSelection().choose(root, "satchel", () => {});
		expect(shown(root)).toEqual(["satchel"]);
		expect(current(root)).toEqual(["satchel"]);
	});

	// Read far down a long major, then chose another: its top has to be where the reader looks.
	it("brings the chosen card into view", () => {
		const root = mount("mindgem", "satchel");
		const reveal = vi.fn();
		new ArcanaSelection().choose(root, "satchel", reveal);
		expect(reveal).toHaveBeenCalledWith(root.querySelector('.stonetop-arcanum-card[data-slug="satchel"]'));
	});

	it("is remembered for the renders after", () => {
		const selection = new ArcanaSelection();
		selection.choose(mount("mindgem", "satchel"), "satchel", () => {});
		const root = mount("mindgem", "satchel");
		selection.restore(root);
		expect(shown(root)).toEqual(["satchel"]);
	});
});
