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
		const catalog = english([{ type: "npc", name: "Nerth serpent", system: { slug: "nerth-serpent" } }, { type: "playbook", name: "x", system: {} }]);
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

	// A row that gains a slug keeps its English, so the translation is still correct at the new key.
	it("rehomes an orphan onto a vacant key whose English is identical", () => {
		const result = run([seeker()], { "the-seeker": {
			"choices/5/text": { source: "Look at us.", text: "Sieh uns an." },
		} });
		expect(entryFor(result, "the-seeker", "description").status).toBe(EntryStatus.TRANSLATED);
		expect(entryFor(result, "the-seeker", "description").text).toBe("Sieh uns an.");
		expect(result.countOf(EntryStatus.ORPHANED)).toBe(0);
	});

	it("leaves an orphan alone when its English is nowhere in the document", () => {
		const result = run([seeker()], { "the-seeker": {
			"choices/5/text": { source: "Not in the packs any more", text: "Weg" },
		} });
		expect(result.countOf(EntryStatus.ORPHANED)).toBe(1);
	});

	it("does not overwrite a key the translator has already filled in", () => {
		const result = run([seeker()], { "the-seeker": {
			description:     { source: "Look at us.", text: "Schon uebersetzt" },
			"choices/5/text": { source: "Look at us.", text: "Sieh uns an." },
		} });
		expect(entryFor(result, "the-seeker", "description").text).toBe("Schon uebersetzt");
		expect(result.countOf(EntryStatus.ORPHANED)).toBe(1);
	});

	// Which of the two was meant is unknowable, and picking one would be a guess.
	it("leaves an orphan orphaned when two vacant keys share that English", () => {
		const twins = seeker({ description: "Same words.", statsNote: "Same words." });
		const result = run([twins], { "the-seeker": {
			"choices/5/text": { source: "Same words.", text: "Gleiche Worte." },
		} });
		expect(result.countOf(EntryStatus.ORPHANED)).toBe(1);
		expect(result.countOf(EntryStatus.TRANSLATED)).toBe(0);
	});

	it("gives a contested vacant key to one orphan and flags the rest", () => {
		const result = run([seeker()], { "the-seeker": {
			"choices/5/text": { source: "Look at us.", text: "Erste." },
			"choices/6/text": { source: "Look at us.", text: "Zweite." },
		} });
		expect(entryFor(result, "the-seeker", "description").text).toBe("Erste.");
		expect(result.countOf(EntryStatus.ORPHANED)).toBe(1);
	});

	// Two addresses, one translation: we rehomed it last installment, they still file it at the old
	// key. Flagging that would ask a human to re-file words the document already carries.
	it("drops an orphan whose German is already live in the same document", () => {
		const result = run([seeker()], { "the-seeker": {
			description:      { source: "Look at us.", text: "Sieh uns an." },
			"choices/5/text": { source: "Look at us.", text: "Sieh uns an." },
		} });
		expect(result.countOf(EntryStatus.ORPHANED)).toBe(0);
		expect(entryFor(result, "the-seeker", "description").status).toBe(EntryStatus.TRANSLATED);
	});

	it("keeps an orphan whose German differs from anything live, even by a word", () => {
		const result = run([seeker()], { "the-seeker": {
			description:      { source: "Look at us.", text: "Sieh uns an." },
			"choices/5/text": { source: "Look at us.", text: "Sieh uns an!" },
		} });
		expect(result.countOf(EntryStatus.ORPHANED)).toBe(1);
	});

	it("does not drop an orphan that merely duplicates another orphan", () => {
		const result = run([seeker()], { "the-seeker": {
			"choices/5/text": { source: "Gone", text: "Weg" },
			"choices/6/text": { source: "Gone", text: "Weg" },
		} });
		expect(result.countOf(EntryStatus.ORPHANED)).toBe(2);
	});

	// The Lightbearer case: a heading folded into the row below it, leaving the live entry holding a
	// translation of only the tail ("(wähle 1)") while the heading's German sat orphaned.
	it("composes a folded heading back onto the row that absorbed it", () => {
		const folded = seeker({ description: "You Came Into Your Powers… (choose 1)" });
		const result = run([folded], { "the-seeker": {
			description:      { source: "You Came Into Your Powers… (choose 1)", text: "(wähle 1)" },
			"choices/0/title": { source: "You Came Into Your Powers…", text: "Du erlangtest deine Kräfte…" },
		} });
		expect(entryFor(result, "the-seeker", "description").text).toBe("Du erlangtest deine Kräfte… (wähle 1)");
		expect(result.countOf(EntryStatus.ORPHANED)).toBe(0);
	});

	it("reports each composition rather than performing it silently", () => {
		const folded = seeker({ description: "You Came Into Your Powers… (choose 1)" });
		const composed = [];
		reconcile("de", "playbooks", englishCatalog([folded]), { "the-seeker": {
			description:      { source: "You Came Into Your Powers… (choose 1)", text: "(wähle 1)" },
			"choices/0/title": { source: "You Came Into Your Powers…", text: "Du erlangtest deine Kräfte…" },
		} }, { onCompose: c => composed.push(c) });
		expect(composed).toHaveLength(1);
		expect(composed[0]).toMatchObject({ slug: "the-seeker", key: "choices/0/title", hostKey: "description" });
	});

	// Without the prefix proof the two halves might belong in either order, or not together at all.
	it("refuses to compose when the live English does not start with the orphan's", () => {
		const other = seeker({ description: "Something else entirely (choose 1)" });
		const result = run([other], { "the-seeker": {
			description:      { source: "Something else entirely (choose 1)", text: "(wähle 1)" },
			"choices/0/title": { source: "You Came Into Your Powers…", text: "Du erlangtest deine Kräfte…" },
		} });
		expect(result.countOf(EntryStatus.ORPHANED)).toBe(1);
	});

	it("does not compose onto a row that has no translation of its own", () => {
		const folded = seeker({ description: "You Came Into Your Powers… (choose 1)" });
		const result = run([folded], { "the-seeker": {
			"choices/0/title": { source: "You Came Into Your Powers…", text: "Du erlangtest deine Kräfte…" },
		} });
		expect(result.countOf(EntryStatus.ORPHANED)).toBe(1);
		expect(entryFor(result, "the-seeker", "description").status).toBe(EntryStatus.UNTRANSLATED);
	});

	it("does not compose twice when the heading is already in the live German", () => {
		const folded = seeker({ description: "You Came Into Your Powers… (choose 1)" });
		const result = run([folded], { "the-seeker": {
			description:      { source: "You Came Into Your Powers… (choose 1)", text: "Du erlangtest deine Kräfte… (wähle 1)" },
			"choices/0/title": { source: "You Came Into Your Powers…", text: "Du erlangtest deine Kräfte…" },
		} });
		expect(entryFor(result, "the-seeker", "description").text).toBe("Du erlangtest deine Kräfte… (wähle 1)");
	});

	it("does not rehome an orphan that never recorded what it was translating", () => {
		const result = run([seeker()], { "the-seeker": {
			"choices/5/text": { source: "", text: "Sieh uns an." },
		} });
		expect(result.countOf(EntryStatus.ORPHANED)).toBe(1);
		expect(entryFor(result, "the-seeker", "description").status).toBe(EntryStatus.UNTRANSLATED);
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

describe("protected markup integrity", () => {
	const linked = text => seeker({ description: text });
	const EN = "See @UUID[Compendium.stonetop.moves.abc123]{Defy Danger} for more.";
	const authoringFor = text => ({ "the-seeker": { description: { source: EN, text } } });
	const statusOf = result => entryFor(result, "the-seeker", "description").status;

	it("accepts a translation that rewrites the label but keeps the target", () => {
		const result = run([linked(EN)], authoringFor("Siehe @UUID[Compendium.stonetop.moves.abc123]{Gefahr trotzen}."));
		expect(statusOf(result)).toBe(EntryStatus.TRANSLATED);
	});

	it("rejects a translation that changes the link target", () => {
		const result = run([linked(EN)], authoringFor("Siehe @UUID[Compendium.stonetop.moves.gefahr]{Gefahr trotzen}."));
		expect(statusOf(result)).toBe(EntryStatus.BROKEN_MARKUP);
		expect(result.isClean).toBe(false);
	});

	it("rejects a translation that drops or duplicates a link", () => {
		expect(statusOf(run([linked(EN)], authoringFor("Siehe die Bewegung.")))).toBe(EntryStatus.BROKEN_MARKUP);
		const twice = "@UUID[Compendium.stonetop.moves.abc123]{A} @UUID[Compendium.stonetop.moves.abc123]{B}";
		expect(statusOf(run([linked(EN)], authoringFor(twice)))).toBe(EntryStatus.BROKEN_MARKUP);
	});

	it("does not ship an entry with broken links", () => {
		const result = run([linked(EN)], authoringFor("Siehe @UUID[falsch]{Gefahr}."));
		expect(result.toRuntime()).toEqual({});
	});

	it("allows the links to be reordered", () => {
		const two = "@UUID[A]{one} then @UUID[B]{two}";
		const result = run([linked(two)], { "the-seeker": { description: { source: two, text: "@UUID[B]{zwei} nach @UUID[A]{eins}" } } });
		expect(statusOf(result)).toBe(EntryStatus.TRANSLATED);
	});

	// Against drifted English the comparison says nothing, so review comes first.
	it("reports drift ahead of link problems", () => {
		const result = run([linked(EN)], { "the-seeker": { description: { source: "older English", text: "kein Link" } } });
		expect(statusOf(result)).toBe(EntryStatus.NEEDS_REVIEW);
	});

	it("ignores links in strings nobody has translated", () => {
		const result = run([linked(EN)], {});
		expect(statusOf(result)).toBe(EntryStatus.UNTRANSLATED);
	});
});
