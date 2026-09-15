import { describe, expect, it } from "vitest";
import { EntryStatus } from "../../scripts/i18n/reconcile.js";
import { HandoffItem, HandoffSlot, HandoffSlots, TranslatorHandoff } from "../../scripts/i18n/handoff.js";

const review = (overrides = {}) => new HandoffItem({
	pack: "moves", slug: "bolster", key: "description", status: EntryStatus.NEEDS_REVIEW,
	english: "New English.", german: "Neues Deutsch.", previousEnglish: "Old English.", ...overrides,
});

const orphan = (overrides = {}) => new HandoffItem({
	pack: "steading-improvements", slug: "palisade", key: "choices/6/text", status: EntryStatus.ORPHANED,
	english: "", german: "Wenn du die Voraussetzungen erfüllst…", ...overrides,
});

describe("HandoffSlots", () => {
	it("caps the list and says so", () => {
		const many = Array.from({ length: 20 }, (_, i) => new HandoffSlot(`k${i}`, `E${i}`));
		const slots = HandoffSlots.of(many);
		expect(slots.length).toBe(12);
		expect(slots.truncated).toBe(true);
	});

	it("does not claim truncation when everything fits", () => {
		const slots = HandoffSlots.of([new HandoffSlot("a", "A")]);
		expect(slots.length).toBe(1);
		expect(slots.truncated).toBe(false);
	});
});

describe("HandoffItem", () => {
	it("shows a review entry's previous and current English alongside the German", () => {
		const md = review().toMarkdown();
		expect(md).toContain("Old English.");
		expect(md).toContain("New English.");
		expect(md).toContain("Neues Deutsch.");
		expect(md).toContain("The English changed");
	});

	it("calls out an edit that only moved markup, so it can be skimmed", () => {
		const item = review({ previousEnglish: "Carry a item", english: "Carry a ◇ item" });
		expect(item.isMarkupOnly).toBe(true);
		expect(item.toMarkdown()).toContain("Markup or spacing only");
	});

	it("treats a reworded sentence as a real review", () => {
		expect(review({ previousEnglish: "One thing", english: "Another thing" }).isMarkupOnly).toBe(false);
	});

	it("is not markup-only when the previous English was never recorded", () => {
		expect(review({ previousEnglish: null }).isMarkupOnly).toBe(false);
	});

	it("omits the Was: block when there is no previous English to show", () => {
		expect(review({ previousEnglish: null }).toMarkdown()).not.toContain("Was:");
	});

	it("lists the untranslated keys an orphan's words could be re-filed into", () => {
		const md = orphan({ slots: HandoffSlots.of([
			new HandoffSlot("effects/0/text", "increase Fortunes by 1"),
			new HandoffSlot("effects/1/text", "add it to the map"),
		]) }).toMarkdown();
		expect(md).toContain("effects/0/text");
		expect(md).toContain("increase Fortunes by 1");
		expect(md).toContain("Wenn du die Voraussetzungen erfüllst…");
	});

	it("says so plainly when an orphan has nowhere left to go", () => {
		expect(orphan().toMarkdown()).toContain("No untranslated keys remain");
	});

	it("never marks an orphan as markup-only", () => {
		expect(orphan({ previousEnglish: "x", english: "x" }).isMarkupOnly).toBe(false);
	});
});

describe("TranslatorHandoff", () => {
	const document = () => new TranslatorHandoff("de", [
		review(),
		review({ slug: "bolster", key: "name", previousEnglish: "A b", english: "A ◇ b" }),
		orphan(),
	]);

	it("separates what needs review from what needs re-filing", () => {
		expect(document().reviews).toHaveLength(2);
		expect(document().orphans).toHaveLength(1);
		expect(document().markupOnly).toHaveLength(1);
	});

	it("counts both kinds in the summary", () => {
		const md = document().toMarkdown();
		expect(md).toContain("**2** entries where the English changed");
		expect(md).toContain("1 of them markup only");
		expect(md).toContain("**1** translations whose row was restructured");
	});

	it("groups entries by pack and slug", () => {
		const packs = document().byPack;
		expect([...packs.keys()]).toEqual(["moves", "steading-improvements"]);
		expect(packs.get("moves").get("bolster")).toHaveLength(2);
	});

	it("renders a heading for every pack and slug it covers", () => {
		const md = document().toMarkdown();
		expect(md).toContain("## moves");
		expect(md).toContain("### bolster");
		expect(md).toContain("## steading-improvements");
		expect(md).toContain("### palisade");
	});

	it("is empty but valid when nothing is flagged", () => {
		const md = new TranslatorHandoff("de", []).toMarkdown();
		expect(md).toContain("**0** translations whose row was restructured");
	});
});
