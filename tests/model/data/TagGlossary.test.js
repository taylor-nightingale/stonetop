import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { TagGlossary, TagDefinition } from "../../../src/model/data/TagGlossary.js";

// The definitions ship as ordinary localized strings, so this reads them the way the system does at
// i18nInit: straight out of the language file's `stonetop.tagGlossary` tree.
const shipped = JSON.parse(
	readFileSync(fileURLToPath(new URL("../../../languages/en.json", import.meta.url)), "utf8"))
	.stonetop.tagGlossary;

describe("TagGlossary.fromTranslations", () => {
	const glossary = TagGlossary.fromTranslations({
		range:    { close: "melee range, 1-2 steps away." },
		artifact: { magical: "imbued with unnatural power" },
	});

	it("looks a tag up by its token", () => {
		expect(glossary.lookup("close").definition).toBe("melee range, 1-2 steps away.");
	});

	// The category is the nesting, so a translator never sees a key they should leave alone.
	it("takes each tag's category from the section it sits in", () => {
		expect(glossary.lookup("close").category).toBe("range");
		expect(glossary.lookup("magical").category).toBe("artifact");
	});

	it("looks up regardless of the casing and spacing an author used", () => {
		expect(glossary.lookup("  Magical ").slug).toBe("magical");
	});

	// The book says "others are certainly possible" — an unknown tag is ordinary, not an error.
	it("returns null for a tag the book does not define", () => {
		expect(glossary.lookup("sharp-eyed")).toBeNull();
	});

	it("offers its slugs as picker options, in book order", () => {
		expect(glossary.labels).toEqual(["close", "magical"]);
	});

	it("skips an entry a translator left blank rather than defining it as empty", () => {
		const sparse = TagGlossary.fromTranslations({ range: { close: "", near: "   ", far: "a way off" } });
		expect(sparse.lookup("close")).toBeNull();
		expect(sparse.lookup("near")).toBeNull();
		expect(sparse.lookup("far").definition).toBe("a way off");
	});

	it("starts empty so a sheet rendering before i18nInit still works", () => {
		expect(new TagGlossary().lookup("close")).toBeNull();
		expect(new TagGlossary().all).toEqual([]);
		expect(TagGlossary.fromTranslations().all).toEqual([]);
		expect(TagGlossary.fromTranslations({ range: null }).all).toEqual([]);
	});

	it("builds a definition with its slug, text and category", () => {
		expect(glossary.lookup("close")).toEqual(new TagDefinition("close", "melee range, 1-2 steps away.", "range"));
	});
});

// The shipped strings are generated from Book I; these guard what the rest of the system assumes
// about them, so a bad regeneration fails here rather than silently emptying every tooltip.
describe("the shipped glossary", () => {
	const glossary = TagGlossary.fromTranslations(shipped);

	it("defines the range tags", () => {
		for (const tag of ["hand", "close", "reach", "near", "far"]) {
			expect(glossary.lookup(tag)?.category).toBe("range");
		}
	});

	it("defines the tags the packs actually use", () => {
		for (const tag of ["area", "awkward", "crude", "dangerous", "fragile", "magical", "thrown", "warm"]) {
			expect(glossary.lookup(tag)).not.toBeNull();
		}
	});

	// The whole point of reading the book's typeface: modifiers are not tags.
	it("excludes the mechanical modifiers", () => {
		for (const term of ["armor", "damage", "piercing", "hours", "uses", "requires"]) {
			expect(glossary.lookup(term)).toBeNull();
		}
	});

	it("groups every entry under one of the book's three sections", () => {
		expect(Object.keys(shipped).sort()).toEqual(["artifact", "general", "range"]);
	});

	it("gives every entry a slug-shaped key and a non-empty definition", () => {
		for (const [category, entries] of Object.entries(shipped)) {
			for (const [slug, definition] of Object.entries(entries)) {
				expect(slug, `${category}.${slug}`).toMatch(/^[a-z0-9-]+$/);
				expect(definition.trim(), `${category}.${slug}`).toBeTruthy();
			}
		}
	});

	it("defines each tag once across the three sections", () => {
		const slugs = Object.values(shipped).flatMap((entries) => Object.keys(entries));
		expect(new Set(slugs).size).toBe(slugs.length);
	});
});
