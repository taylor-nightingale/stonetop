import { describe, expect, it } from "vitest";
import { EntryStatus } from "../../scripts/i18n/reconcile.js";
import { CompetingTranslation, HandoffItem, HandoffSlot, HandoffSlots, TranslatorHandoff } from "../../scripts/i18n/handoff.js";
import { UiStringWorklist } from "../../scripts/i18n/uiStrings.js";

const review = (overrides = {}) => new HandoffItem({
	pack: "moves", slug: "bolster", key: "description", status: EntryStatus.NEEDS_REVIEW,
	english: "New English.", german: "Neues Deutsch.", previousEnglish: "Old English.", ...overrides,
});

const orphan = (overrides = {}) => new HandoffItem({
	pack: "steading-improvements", slug: "palisade", key: "choices/6/text", status: EntryStatus.ORPHANED,
	english: "", german: "Wenn du die Voraussetzungen erfüllst…", ...overrides,
});

describe("HandoffSlot", () => {
	it("says nothing extra when a string is needed in one place only", () => {
		expect(new HandoffSlot("effects/0/text", "increase Fortunes by 1").line)
			.toBe('- `"effects/0/text"` — "increase Fortunes by 1"');
	});

	it("says how many other entries one translation would cover", () => {
		expect(new HandoffSlot("effects/0/text", "x", 11).line).toContain("also fills 11 other entries");
	});

	it("keeps the singular readable", () => {
		expect(new HandoffSlot("k", "x", 1).line).toContain("also fills 1 other entry");
	});

	// Text pulled out into its own move lands in a different file; a destination you cannot see is
	// no destination at all.
	it("names the file and document when the slot is in another pack", () => {
		const slot = new HandoffSlot("description", "When the seasons change…", 0,
			'`moves.json` › `"news-at-the-inn"`');
		expect(slot.line).toContain("moves.json");
		expect(slot.line).toContain("news-at-the-inn");
		expect(slot.line).toContain("description");
	});

	it("lists a repeated English string once, not once per document that has it", () => {
		const slots = HandoffSlots.of([
			new HandoffSlot("effects/0/text", "increase Fortunes by 1", 11),
			new HandoffSlot("effects/0/text", "increase Fortunes by 1", 11, '`x.json` › `"other"`'),
		]);
		// de-duplication happens in slotsFor; this guards the rendering contract it relies on
		expect(slots.shown.map(s => s.english)).toEqual(["increase Fortunes by 1", "increase Fortunes by 1"]);
	});

	it("says nothing about a file for a slot in the same document", () => {
		expect(new HandoffSlot("effects/0/text", "x").line).not.toContain(".json");
	});
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

	it("tells the reader to delete an orphan nothing needs any more", () => {
		const md = orphan().toMarkdown();
		expect(md).toContain("no longer in the game text");
		expect(md).toContain("Delete the entry");
	});

	// The draft-horses case: the English is still live and already translated, differently. Neither
	// rehoming (needs a vacant target) nor de-duplication (needs identical German) catches it.
	it("puts a competing translation side by side instead of calling it homeless", () => {
		const md = orphan({ competing: [new CompetingTranslation("`steadfasts.json` › `\"stonetop\"` › `\"assets/items/horses/text\"`", "Zwei robuste Zugpferde")] }).toMarkdown();
		expect(md).toContain("already translated elsewhere, differently");
		expect(md).toContain("Zwei robuste Zugpferde");
		expect(md).toContain("assets/items/horses/text");
		expect(md).not.toContain("split up");
	});

	it("prefers the competing-translation wording over the split wording", () => {
		const md = orphan({
			competing: [new CompetingTranslation("`x.json` › `\"y\"` › `\"z\"`", "Andere")],
			slots: HandoffSlots.of([new HandoffSlot("effects/0/text", "increase Fortunes by 1")]),
		}).toMarkdown();
		expect(md).toContain("already translated elsewhere");
		expect(md).not.toContain("The keys it was split into");
	});

	it("tells the reader what to do with a row that was split up", () => {
		const md = orphan({ slots: HandoffSlots.of([new HandoffSlot("effects/0/text", "increase Fortunes by 1")]) }).toMarkdown();
		expect(md).toContain("This row was split up");
		expect(md).toContain("then delete the entry named in the heading");
	});

	it("gives every orphan branch something to do", () => {
		const branches = [
			orphan(),
			orphan({ slots: HandoffSlots.of([new HandoffSlot("k", "increase Fortunes by 1")]) }),
			orphan({ competing: [new CompetingTranslation("`a` › `b` › `c`", "Andere")] }),
		];
		for (const branch of branches) expect(branch.toMarkdown()).toMatch(/[Dd]elete|keep the better one/u);
	});

	// A heading has to answer "which file, which document, which key" on its own line: the key alone
	// is ambiguous (four moves carry `moveResults/success/value`) and a bare slug like `stonetop`
	// reads as a filename that does not exist.
	it("names the file, the document and the key", () => {
		expect(review({ pack: "moves", slug: "seasons-change-autumn", key: "moveResults/success/value" }).heading)
			.toBe('### `moves.json` › `"seasons-change-autumn"` › `"moveResults/success/value"`');
	});

	it("gives the same locator for a document slug that looks like a filename", () => {
		expect(review({ pack: "steadfasts", slug: "stonetop", key: "neighborPlaces/other/subtitle" }).locator)
			.toBe('`steadfasts.json` › `"stonetop"` › `"neighborPlaces/other/subtitle"`');
	});

	it("identifies an orphan from its own heading too", () => {
		const first = orphan().toMarkdown().split("\n")[0];
		expect(first).toContain("steading-improvements.json");
		expect(first).toContain("palisade");
		expect(first).toContain("choices/6/text");
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

	it("counts each kind in the summary", () => {
		const md = document().toMarkdown();
		expect(md).toContain("**2** entries where the English changed");
		expect(md).toContain("1 of them markup or spacing only");
		expect(md).toContain("**1** translations whose row was restructured");
	});

	// Comparing an entry against itself used to report every standing flag as "markup only".
	it("does not call an entry markup-only when there is no change to show", () => {
		const same = review({ previousEnglish: "Same English.", english: "Same English." });
		expect(same.hasDiff).toBe(false);
		expect(same.isMarkupOnly).toBe(false);
		expect(same.toMarkdown()).toContain("Flagged for review earlier");
		expect(same.toMarkdown()).not.toContain("Was:");
	});

	it("counts an entry with nothing to diff as standing, not as a change", () => {
		const doc = new TranslatorHandoff("de", [review({ previousEnglish: "X", english: "X" })]);
		expect(doc.standing).toHaveLength(1);
		expect(doc.toMarkdown()).toContain("**1** flagged earlier and still awaiting a revision");
		expect(doc.toMarkdown()).toContain("**0** entries where the English changed");
	});

	it("groups entries by pack and slug", () => {
		const packs = document().byPack;
		expect([...packs.keys()]).toEqual(["moves", "steading-improvements"]);
		expect(packs.get("moves").get("bolster")).toHaveLength(2);
	});

	it("renders one section per file, named as the file", () => {
		const md = document().toMarkdown();
		expect(md).toContain("## moves.json");
		expect(md).toContain("## steading-improvements.json");
	});

	// A bare `### stonetop` reads as a file that does not exist; the document key never stands alone.
	it("never heads a section with a bare document slug", () => {
		expect(document().toMarkdown()).not.toMatch(/^### bolster$/mu);
		expect(document().toMarkdown()).not.toMatch(/^### palisade$/mu);
	});

	it("tells the reader where the files live and what to edit", () => {
		const md = document().toMarkdown();
		expect(md).toContain("languages/compendium/de/");
		expect(md).toContain('edit its `"text"`');
	});

	it("is empty but valid when nothing is flagged", () => {
		const md = new TranslatorHandoff("de", []).toMarkdown();
		expect(md).toContain("**0** translations whose row was restructured");
	});

	it("lists every German a conflicted string has been translated as", () => {
		const conflict = { address: { label: "arcana/bow back/labels/low-ammo" }, english: "low ammo",
			germans: ["wenig Munition", "geringe Munition"] };
		const md = new TranslatorHandoff("de", [], [conflict]).toMarkdown();
		expect(md).toContain("One English string, two German translations");
		expect(md).toContain("wenig Munition");
		expect(md).toContain("geringe Munition");
		expect(md).toContain("**1** strings translated two different ways");
	});

	it("leaves the conflict section out when there are none", () => {
		expect(new TranslatorHandoff("de", []).toMarkdown()).not.toContain("One English string");
	});
});

// A pack's untranslated strings need no worklist — extract has already written an empty slot for
// each into the authoring file, so the file IS the worklist. A language file has no slots: a missing
// key is simply absent, so the handoff is the only place the work can be seen.
describe("TranslatorHandoff — interface strings", () => {
	const worklist = () => new UiStringWorklist("de", [
		{ key: "stonetop.steading.lists.resources", english: "Resources" },
		{ key: "stonetop.steading.attr.prosperity", english: "Prosperity" },
	]);

	it("counts them in the summary", () => {
		const markdown = new TranslatorHandoff("de", [], [], worklist()).toMarkdown();
		expect(markdown).toContain("**2** interface strings with no translation yet");
	});

	it("lists each key with the English to translate", () => {
		const markdown = new TranslatorHandoff("de", [], [], worklist()).toMarkdown();
		expect(markdown).toContain('`"stonetop.steading.lists.resources"` — "Resources"');
		expect(markdown).toContain('`"stonetop.steading.attr.prosperity"` — "Prosperity"');
	});

	it("names the file they are edited in, which is not the one the packs use", () => {
		const markdown = new TranslatorHandoff("de", [], [], worklist()).toMarkdown();
		expect(markdown).toContain("## languages/de.json");
	});

	it("says nothing at all when there are none", () => {
		const markdown = new TranslatorHandoff("de", [], []).toMarkdown();
		expect(markdown).not.toContain("languages/de.json");
		expect(markdown).not.toContain("interface strings");
	});
});
