import { describe, it, expect } from "vitest";
import { BookItem } from "../../scripts/import/pdf/items.js";
import { ValueGuide, ValueTier } from "../../scripts/import/pdf/value-ladder.js";
import { ResolvedRow, OUTFIT_PACK } from "../../scripts/import/item-docs.js";
import {
	renderResource, renderDetail, renderInline, renderCategory, renderValueGuide, renderItemReference,
} from "../../scripts/import/item-reference.js";

const bookItem = (name, patch = {}) => Object.assign(new BookItem("common", "weapons"), { name }, patch);
const linked = (item, id = "abcdefgh12345678") =>
	new ResolvedRow(item, { id, pack: OUTFIT_PACK, existing: true, kind: "outfitItem" });
const unlinked = (item) => new ResolvedRow(item, { id: null, pack: null, existing: false, kind: "category" });

describe("renderResource", () => {
	it("gives each labelled slot its own circle", () => {
		expect(renderResource({ max: 2, labels: ["low ammo", "all out"] })).toEqual(["○ low ammo", "○ all out"]);
	});

	// "○○○ hours", the way the book sets it — not "○, ○, ○ hours".
	it("runs unlabelled slots together onto the label that follows them", () => {
		expect(renderResource({ max: 3, labels: ["", "", "hours"] })).toEqual(["○○○ hours"]);
	});

	it("renders a wholly unlabelled track as bare circles", () => {
		expect(renderResource({ max: 2, labels: ["", ""] })).toEqual(["○○"]);
	});

	it("has nothing to render for an item with no track", () => {
		expect(renderResource(null)).toEqual([]);
	});
});

describe("renderDetail", () => {
	it("sets tags in italics and mechanical notes roman, as the book does", () => {
		const html = renderDetail(bookItem("Bow", { tagList: ["near"], note: "x piercing" }));
		expect(html).toBe('<span class="item-ref-detail">(<em>near</em>, x piercing)</span>');
	});

	it("adds the resource track after the note", () => {
		const html = renderDetail(bookItem("Bow", {
			tagList: ["near"], note: "x piercing", resource: { max: 1, labels: ["all out"] },
		}));
		expect(html).toContain("x piercing, ○ all out)");
	});

	it("renders nothing for an item the book prints bare", () => {
		expect(renderDetail(bookItem("Gloves"))).toBe("");
	});
});

describe("renderInline", () => {
	it("turns the stat blocks' emphasis markers into HTML and escapes the rest", () => {
		expect(renderInline("d6 (_hand_, _grabby_)")).toBe("d6 (<em>hand</em>, <em>grabby</em>)");
		expect(renderInline("Bow & arrows")).toBe("Bow &amp; arrows");
	});
});

describe("renderCategory", () => {
	const section = { title: "weapons", footnote: "" };

	it("links a resolved row's name so it can be dragged onto a sheet", () => {
		const item = bookItem("Bow & iron arrows", { value: 0, weight: 1 });
		const html = renderCategory(section, [linked(item)], { title: "Weapons" });
		expect(html).toContain(`@UUID[Compendium.stonetop.${OUTFIT_PACK}.Item.abcdefgh12345678]{Bow &amp; iron arrows}`);
	});

	it("leaves a cross-reference row as plain text", () => {
		const html = renderCategory(section, [unlinked(bookItem("Weapons of war"))], { title: "Bronze Weapons" });
		expect(html).not.toContain("@UUID");
		expect(html).toContain("Weapons of war");
	});

	it("orders rows by Value, keeping the book's order within one Value", () => {
		const rows = [
			linked(bookItem("Vest", { value: 3 }), "aaaaaaaaaaaaaaaa"),
			linked(bookItem("Cuirass", { value: 1 }), "bbbbbbbbbbbbbbbb"),
			linked(bookItem("Hauberk", { value: 2 }), "cccccccccccccccc"),
		];
		const html = renderCategory(section, rows, { title: "Armor" });
		expect(html.indexOf("Cuirass")).toBeLessThan(html.indexOf("Hauberk"));
		expect(html.indexOf("Hauberk")).toBeLessThan(html.indexOf("Vest"));
	});

	it("shows the load as diamonds, and a small item as the book's □", () => {
		const html = renderCategory(section, [
			linked(bookItem("Maul", { weight: 2 })), linked(bookItem("Gloves", { weight: 0 })),
		], { title: "Weapons" });
		expect(html).toContain(">◇◇<");
		expect(html).toContain(">□<");
	});

	it("marks a starred Value and prints the section's footnote", () => {
		const html = renderCategory({ title: "weapons of war", footnote: "*Value 2 to get 1 piercing" },
			[linked(bookItem("Battleaxe", { value: 1, footnoted: true }))], { title: "Weapons of War" });
		expect(html).toContain(">1*<");
		expect(html).toContain("*Value 2 to get 1 piercing");
	});

	it("puts a livestock stat block under the name", () => {
		const item = bookItem("Dog", { value: 1, statBlock: "HP 6; Damage d6 (_hand_)" });
		const html = renderCategory(section, [linked(item)], { title: "Livestock" });
		expect(html).toContain('<div class="item-ref-stats">HP 6; Damage d6 (<em>hand</em>)</div>');
	});
});

describe("renderValueGuide", () => {
	const guide = () => {
		const g = new ValueGuide();
		g.lead = "Exchange rates are far from standard, but...";
		const tier = new ValueTier(0);
		tier.equivalences = ["A ◇ purse of copper coins", "A favor"];
		g.tiers = [tier];
		g.notes = ["* Exotic trade goods are +1 Value"];
		g.coins.paragraphs = ["_Stonetop_ abstracts coinage."];
		g.coins.bullets = ["A handful is about 10 coins."];
		return g;
	};

	it("renders a card per rung, the notes, and the Coins sidebar", () => {
		const html = renderValueGuide(guide());
		expect(html).toContain("<h3>Value 0</h3>");
		expect(html).toContain("<li>A ◇ purse of copper coins</li>");
		expect(html).toContain("* Exotic trade goods are +1 Value");
		expect(html).toContain("<h2>Coins</h2>");
		expect(html).toContain("<em>Stonetop</em> abstracts coinage.");
		expect(html).toContain("<li>A handful is about 10 coins.</li>");
	});
});

describe("renderItemReference", () => {
	it("renders each table with its lead and its categories", () => {
		const item = bookItem("Sword, iron", { value: 1 });
		const section = { title: "weapons of war", footnote: "", items: [item] };
		const html = renderItemReference({
			guide: new ValueGuide(),
			tables: [{ name: "Special items", lead: "If you want to acquire any of these items…", sections: [section] }],
			rowsFor: () => [linked(item)],
			sectionTitle: (t) => t,
			bookPages: "92-97",
		});
		expect(html).toContain('<div class="stonetop-item-reference">');
		expect(html).toContain("Stonetop — p.92-97");
		expect(html).toContain("<h2>Special items</h2>");
		expect(html).toContain("If you want to acquire any of these items…");
		expect(html).toContain("Sword, iron");
	});
});
