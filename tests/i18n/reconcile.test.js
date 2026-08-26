import { describe, expect, it } from "vitest";
import { EntryStatus, reconcile } from "../../scripts/i18n/reconcile.js";
import { DuplicateKeyError, englishCatalog } from "../../scripts/i18n/packCatalog.js";

const seeker = (overrides = {}) => ({
	type: "playbook",
	name: "The Seeker",
	system: { slug: "the-seeker", description: "Look at us.", statsNote: "+2, +1", ...overrides },
});

const english = docs => englishCatalog(docs);
const run = (docs, authoring) => reconcile("de", "playbooks", english(docs), authoring);
const entryFor = (result, slug, key) =>
	result.documentsByType.get("playbook").find(d => d.slug === slug).entries.find(e => e.key === key);

describe("englishCatalog", () => {
	it("files strings by type, slug and key", () => {
		const catalog = english([seeker()]);
		expect(catalog.get("playbook").get("the-seeker").get("name")).toBe("The Seeker");
		expect(catalog.get("playbook").get("the-seeker").get("description")).toBe("Look at us.");
	});

	it("skips documents of untranslated types and documents with no slug", () => {
		const catalog = english([{ type: "move", name: "Defy Danger", system: { slug: "defy-danger" } }, { type: "playbook", name: "x", system: {} }]);
		expect(catalog.size).toBe(0);
	});

	it("refuses to build when two rows share a slug", () => {
		const doc = seeker({ backgrounds: [{ slug: "same", label: "A" }, { slug: "same", label: "B" }] });
		expect(() => english([doc])).toThrow(DuplicateKeyError);
		expect(() => english([doc])).toThrow(/backgrounds\/same\/label/);
	});
});

describe("reconcile", () => {
	it("marks a string with no translation untranslated", () => {
		const result = run([seeker()], {});
		expect(entryFor(result, "the-seeker", "name").status).toBe(EntryStatus.UNTRANSLATED);
		expect(result.countOf(EntryStatus.UNTRANSLATED)).toBe(3);
	});

	it("treats a blank or missing text as untranslated", () => {
		const result = run([seeker()], { "the-seeker": { name: { source: "The Seeker", text: "   " }, description: { source: "Look at us." } } });
		expect(entryFor(result, "the-seeker", "name").status).toBe(EntryStatus.UNTRANSLATED);
		expect(entryFor(result, "the-seeker", "description").status).toBe(EntryStatus.UNTRANSLATED);
	});

	it("marks a translation matching the current English as translated", () => {
		const result = run([seeker()], { "the-seeker": { name: { source: "The Seeker", text: "Der Sucher" } } });
		expect(entryFor(result, "the-seeker", "name").status).toBe(EntryStatus.TRANSLATED);
		expect(result.toRuntime()).toEqual({ playbook: { "the-seeker": { name: "Der Sucher" } } });
	});

	it("flags a translation whose English has since changed, and shows the new English", () => {
		const result = run([seeker()], { "the-seeker": { name: { source: "The Seeker (old)", text: "Der Sucher" } } });
		const entry = entryFor(result, "the-seeker", "name");
		expect(entry.status).toBe(EntryStatus.NEEDS_REVIEW);
		expect(entry.source).toBe("The Seeker");
		expect(entry.text).toBe("Der Sucher");
		expect(entry.toAuthoring()).toEqual({ source: "The Seeker", text: "Der Sucher", needsReview: true });
	});

	it("keeps a needsReview mark until a human removes it, even once the source matches", () => {
		const authoring = { "the-seeker": { name: { source: "The Seeker", text: "Der Sucher", needsReview: true } } };
		expect(entryFor(run([seeker()], authoring), "the-seeker", "name").status).toBe(EntryStatus.NEEDS_REVIEW);

		delete authoring["the-seeker"].name.needsReview;
		expect(entryFor(run([seeker()], authoring), "the-seeker", "name").status).toBe(EntryStatus.TRANSLATED);
	});

	it("keeps a translation whose key has disappeared, marked orphaned", () => {
		const result = run([seeker()], { "the-seeker": { "choices/gone/text": { source: "Gone", text: "Weg" } } });
		const entry = entryFor(result, "the-seeker", "choices/gone/text");
		expect(entry.status).toBe(EntryStatus.ORPHANED);
		expect(entry.text).toBe("Weg");
		expect(entry.toAuthoring()).toEqual({ source: "Gone", text: "Weg", orphaned: true });
	});

	it("drops an orphan with no words in it rather than carrying it forever", () => {
		const result = run([seeker()], { "the-seeker": { "choices/gone/text": { source: "Gone", text: "" } } });
		expect(result.countOf(EntryStatus.ORPHANED)).toBe(0);
	});

	it("ships only entries that are translated and current", () => {
		const result = run([seeker()], { "the-seeker": {
			name:        { source: "The Seeker", text: "Der Sucher" },
			description: { source: "Old",        text: "Alt" },
			statsNote:   { source: "+2, +1",     text: "" },
			"choices/gone/text": { source: "Gone", text: "Weg" },
		} });
		expect(result.toRuntime()).toEqual({ playbook: { "the-seeker": { name: "Der Sucher" } } });
	});

	it("omits a document and a type that have nothing to ship", () => {
		expect(run([seeker()], {}).toRuntime()).toEqual({});
	});

	it("reports drift as unclean and lists what needs attention", () => {
		const clean = run([seeker()], { "the-seeker": { name: { source: "The Seeker", text: "Der Sucher" } } });
		expect(clean.isClean).toBe(true);

		const drifted = run([seeker()], { "the-seeker": {
			name: { source: "Old", text: "Der Sucher" },
			"choices/gone/text": { source: "Gone", text: "Weg" },
		} });
		expect(drifted.isClean).toBe(false);
		expect(drifted.entriesWith(EntryStatus.NEEDS_REVIEW).map(e => e.entry.key)).toEqual(["name"]);
		expect(drifted.entriesWith(EntryStatus.ORPHANED)[0]).toMatchObject({ type: "playbook", slug: "the-seeker" });
	});

	it("writes an authoring file covering every English string, in allowlist order", () => {
		const authoring = run([seeker()], {}).toAuthoring();
		expect(Object.keys(authoring)).toEqual(["the-seeker"]);
		expect(Object.keys(authoring["the-seeker"])).toEqual(["name", "description", "statsNote"]);
		expect(authoring["the-seeker"].name).toEqual({ source: "The Seeker", text: "" });
	});

	it("preserves a translation across a reorder of the underlying rows", () => {
		const rows = [{ slug: "patriot", label: "Patriot" }, { slug: "antiquarian", label: "Antiquarian" }];
		const authoring = { "the-seeker": { "backgrounds/patriot/label": { source: "Patriot", text: "Patriotin" } } };
		const before = run([seeker({ backgrounds: rows })], authoring);
		const after  = run([seeker({ backgrounds: [...rows].reverse() })], authoring);
		expect(before.toRuntime()).toEqual(after.toRuntime());
		expect(after.countOf(EntryStatus.NEEDS_REVIEW)).toBe(0);
	});
});

describe("authoring file ordering", () => {
	it("keeps each section's strings together rather than grouping by field", () => {
		const doc = seeker({ backgrounds: [
			{ slug: "patriot", label: "Patriot", description: "Family." },
			{ slug: "antiquarian", label: "Antiquarian", description: "Secrets." },
		] });
		const keys = Object.keys(run([doc], {}).toAuthoring()["the-seeker"]);
		expect(keys).toEqual([
			"name", "description", "statsNote",
			"backgrounds/patriot/label", "backgrounds/patriot/description",
			"backgrounds/antiquarian/label", "backgrounds/antiquarian/description",
		]);
	});
});
