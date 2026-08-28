// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from "vitest";
import { renderPartial } from "../fakes/renderTemplate.js";
import { OutfitPage, toOutfitItemSnapshot } from "../../src/model/snapshot/character/outfitSections.js";
import { InventoryPage, InventoryColumn, PageSection } from "../../src/model/data/character/InventoryPage.js";
import { OutfitItemBuilder } from "../../src/model/data/character/OutfitItem.js";

// Both inventory columns are drawn by ONE partial. The small column used to hand-roll its own row
// markup in tab-equipment.hbs, and the two had already drifted: small rows dropped their tags, so
// "Knife or dagger, iron" printed bare in one column and complete in the other.
//
// The rows and their order come from the PAGE; the gear itself comes from the catalog. Gear the page
// does not list — what a possession or arcanum granted — trails at the BOTTOM of its column, which is
// where a player looks for what they picked up. Rendering from real snapshot data is what pins that:
// a section list on its own can't show where a row lands on the page.

const gear = (slug, name, column, tags = [], qualifier = "") => new OutfitItemBuilder()
	.withSlug(slug).withName(name).withQualifier(qualifier)
	.withWeight(column === "small" ? 1 : 2)
	.withInventoryColumn(column).withTags(tags).withNote(null).build();

const CATALOG = new Map([
	gear("hatchet", "Hatchet", "regular", ["hand"], "iron"),
	gear("shield", "Shield", "regular"),
	gear("rope", "Rope", "regular", [], "~25 ft"),
	gear("shovel", "Shovel", "regular"),
	gear("knife", "Knife or dagger", "small", ["hand"], "iron"),
	gear("awl", "Awl", "small"),
].map(i => [i.slug, i]));

const PAGE = new InventoryPage([
	new InventoryColumn("regular", [
		new PageSection(["hatchet"], { note: "stonetop.inventory.supplies.note" }),
		new PageSection(["shield", ["rope", "shovel"]]),
	]),
	new InventoryColumn("small", [new PageSection(["knife", "awl"])]),
]);

const granted = (slug, name, column) => new OutfitItemBuilder()
	.withSlug(slug).withName(name).withWeight(1).withInventoryColumn(column).withTags([]).withNote(null).build();
const OFF_PAGE = [granted("sword", "Sword, iron", "regular"), granted("bendis-root", "Bendis root", "small")];

function render(column, { square }) {
	const page = new OutfitPage(PAGE, CATALOG, key => `localized:${key}`);
	const sections = page.forColumn(column, OFF_PAGE, oi => toOutfitItemSnapshot(oi, false, null));
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
		expect(rowSlugs(regular)).toEqual(["hatchet", "shield", "rope", "shovel", "sword"]);
	});

	it("renders the small column the same way — granted gear last, not interspersed", () => {
		expect(rowSlugs(small)).toEqual(["knife", "awl", "bendis-root"]);
	});

	// The item is what you carry; the qualifier says which one. Bolding only the first is what
	// separates the thing from the tags and notes trailing it.
	it("sets the item bold and what qualifies it roman", () => {
		const row = [...regular.querySelectorAll(".stonetop-inv-item")]
			.find(el => el.querySelector('input[data-slug="rope"]'));
		expect(row.querySelector(".stonetop-inv-name").textContent).toBe("Rope");
		expect(row.querySelector(".stonetop-inv-qualifier").textContent).toBe(", ~25 ft");
	});

	it("leaves the qualifier out entirely for gear the book qualifies with nothing", () => {
		const row = [...regular.querySelectorAll(".stonetop-inv-item")]
			.find(el => el.querySelector('input[data-slug="shield"]'));
		expect(row.querySelector(".stonetop-inv-name").textContent).toBe("Shield");
		expect(row.querySelector(".stonetop-inv-qualifier")).toBeNull();
	});

	// The insert prints "Use supplies to Recover…" under the three supplies rows, not above the whole
	// list. The note belongs to its section, so it lands where the page puts it.
	it("prints a section's prose under that section, not above the column", () => {
		const notes = [...regular.querySelectorAll(".stonetop-inv-section-note")];
		expect(notes).toHaveLength(1);
		expect(notes[0].textContent).toBe("localized:stonetop.inventory.supplies.note");
		// after the hatchet row it belongs to, and before the next section's rule
		const order = [...regular.children].map(el => el.className);
		expect(order.indexOf("stonetop-inv-section-note")).toBeLessThan(order.indexOf("stonetop-inv-divider"));
	});

	// The page states which lines are set two-across; nothing re-derives it from the rows.
	it("sets a two-across run as a grid and leaves the rest plain", () => {
		const grids = regular.querySelectorAll(".stonetop-inv-twocol-grid");
		expect(grids).toHaveLength(1);
		expect([...grids[0].querySelectorAll(".stonetop-inv-item")]
			.map(el => el.querySelector("input[data-slug]").dataset.slug))
			.toEqual(["rope", "shovel"]);
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
