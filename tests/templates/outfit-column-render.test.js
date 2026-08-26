// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from "vitest";
import { renderPartial } from "../fakes/renderTemplate.js";
import { buildOutfitColumn } from "../../src/model/snapshot/character/outfitSections.js";

// Both inventory columns are drawn by ONE partial. The small column used to hand-roll its own row
// markup in tab-equipment.hbs, and the two had already drifted: small rows dropped their tags, so
// "Knife or dagger, iron (hand)" printed bare in one column and complete in the other.
//
// The pack items a character never chose are the printed insert's own rows, grouped by folder; the
// gear a possession or arcanum granted trails as one unnamed section at the BOTTOM of its column,
// which is where a player looks for what they picked up. Rendering both columns from real snapshot
// data is what pins that — a section list on its own can't show where a row lands on the page.

const repoItem = (slug, name, column, group, tags = []) =>
	({ slug, name, weight: column === "small" ? 1 : 2, inventoryColumn: column, group, tags, note: null });
const granted = (slug, name, column) =>
	({ slug, name, weight: 1, inventoryColumn: column, group: null, tags: [], note: null, ownedId: null });

const REPO = [
	repoItem("hatchet", "Hatchet, iron", "regular", "Weapons", ["hand"]),
	repoItem("shield", "Shield", "regular", "Armor"),
	repoItem("knife", "Knife or dagger, iron", "small", "Basics", ["hand"]),
	repoItem("awl", "Awl", "small", "Sundries"),
];
const EMBEDDED = [granted("sword", "Sword, iron", "regular"), granted("bendis-root", "Bendis root", "small")];

function render(column, { square }) {
	const sections = buildOutfitColumn(REPO, EMBEDDED, {}, column);
	const html = renderPartial("stonetop.outfit-items", { sections, addColumn: column, square });
	const root = document.createElement("div");
	root.innerHTML = html;
	return root;
}

const rowSlugs = (root) =>
	[...root.querySelectorAll(".stonetop-inv-item")]
		.map(el => el.querySelector("input[data-slug]")?.dataset.slug);

describe("outfit column rendering", () => {
	let regular, small;
	beforeAll(() => {
		regular = render("regular", { square: false });
		small   = render("small",   { square: true });
	});

	it("renders the load column's rows in printed order, granted gear last", () => {
		expect(rowSlugs(regular)).toEqual(["hatchet", "shield", "sword"]);
	});

	it("renders the small column the same way — granted gear last, not interspersed", () => {
		expect(rowSlugs(small)).toEqual(["knife", "awl", "bendis-root"]);
	});

	// The bug this replaces: the hand-rolled small rows printed the name and nothing else.
	it("prints an item's tags in BOTH columns", () => {
		const tagsFor = (root, slug) => [...root.querySelectorAll(".stonetop-inv-item")]
			.find(el => el.querySelector(`input[data-slug="${slug}"]`))
			?.querySelector(".stonetop-inv-parens")?.textContent.trim();
		expect(tagsFor(regular, "hatchet")).toBe("(hand)");
		expect(tagsFor(small, "knife")).toBe("(hand)");
	});

	// A load item is marked once per ◇ it costs; a small item costs no load and takes a single □.
	it("marks a load item per diamond and a small item with one square", () => {
		expect(regular.querySelectorAll('[data-slug="hatchet"]')).toHaveLength(2);
		expect(regular.querySelectorAll(".stonetop-inv-square")).toHaveLength(0);
		expect(small.querySelectorAll('[data-slug="knife"]')).toHaveLength(1);
		expect(small.querySelectorAll(".stonetop-inv-diamond")).toHaveLength(0);
	});

	// Clicking a small item's name toggles it; a ◇ row can't be a label, since one would target only
	// the first of its several diamonds.
	it("wraps a small row in its label so the name is clickable", () => {
		expect(small.querySelector(".stonetop-inv-item").tagName).toBe("LABEL");
		expect(regular.querySelector(".stonetop-inv-item").tagName).toBe("DIV");
	});

	it("gives every checkbox in both columns an accessible name", () => {
		for (const root of [regular, small])
			for (const box of root.querySelectorAll("input[type=checkbox]"))
				expect(box.getAttribute("aria-label")).toBeTruthy();
	});

	it("labels the add button for the column it adds to", () => {
		expect(renderPartial("stonetop.outfit-items", { sections: [], addColumn: "small", addLabel: "stonetop.inventory.addSmallItem" }))
			.toContain("stonetop.inventory.addSmallItem");
		expect(renderPartial("stonetop.outfit-items", { sections: [], addColumn: "regular" }))
			.toContain("stonetop.inventory.addItem");
	});
});
