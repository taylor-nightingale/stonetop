import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { englishCatalog } from "../../scripts/i18n/packCatalog.js";
import { reconcile } from "../../scripts/i18n/reconcile.js";
import { babeleTranslationFile, documentIdentities } from "../../scripts/i18n/buildBabele.js";
import { stonetopStringsConverter } from "../../src/i18n/babeleConverter.js";

// End-to-end over real pack data, along the route a translation actually travels:
//   packs/src → extract → translator's file → reconcile → Babele translation file → converter.
//
// The build and the runtime derive translation keys from the same module, and nothing else checks
// that they still agree. If they drift apart every translation silently stops resolving, and the
// symptom — English text — is indistinguishable from an untranslated string.

const load = slug => JSON.parse(readFileSync(`packs/src/playbooks/${slug}.json`, "utf8"));

/** An authoring file translating `keys`, with `source` matching the English actually in the pack. */
function authoringFor(document, keys, translate) {
	const strings = englishCatalog([document]).get("playbook").get(document.system.slug);
	const authored = {};
	for (const key of keys) {
		expect(strings.has(key), `no such English key: ${key}`).toBe(true);
		authored[key] = { source: strings.get(key), text: translate(strings.get(key)) };
	}
	return { [document.system.slug]: authored };
}

/** Compile to a Babele file and apply it the way Babele's field mapping does. */
function shipAndApply(document, authoring) {
	const result = reconcile("de", "playbooks", englishCatalog([document]), authoring);
	const file   = babeleTranslationFile("Playbooks", result.toRuntime(), documentIdentities([document]));
	const entry  = file.entries[document._id] ?? {};

	const system = stonetopStringsConverter(document.system, entry.stonetop, document);
	return { ...document, name: entry.name ?? document.name, system: system ?? document.system };
}

describe("the translation pipeline, over the real playbooks pack", () => {
	const KEYS = [
		"name",
		"description",
		"backgrounds/patriot/description",
		"choices/arcana-major/where-acquired/text",
	];

	it("resolves at runtime every key the extractor produced", () => {
		const document  = load("the-seeker");
		const translated = shipAndApply(document, authoringFor(document, KEYS, en => `[de] ${en}`));

		expect(translated.name).toBe("[de] The Seeker");
		expect(translated.system.description.startsWith("[de] Look at us.")).toBe(true);
		expect(translated.system.backgrounds.find(b => b.slug === "patriot").description.startsWith("[de] ")).toBe(true);
		const group = translated.system.choices.find(g => g.slug === "arcana-major");
		expect(group.list.find(e => e.slug === "where-acquired").content.text)
			.toBe("[de] Where did you acquire it?");
	});

	it("leaves everything the translator did not touch in English", () => {
		const document   = load("the-seeker");
		const translated = shipAndApply(document, authoringFor(document, ["name"], () => "Der Sucher"));

		expect(translated.name).toBe("Der Sucher");
		expect(translated.system).toEqual(load("the-seeker").system);
	});

	it("does not alter the pack document Babele handed to the converter", () => {
		const document = load("the-seeker");
		shipAndApply(document, authoringFor(document, KEYS, en => `[de] ${en}`));
		expect(document.system.description).toBe(load("the-seeker").system.description);
	});

	it("carries no structure into the translation file", () => {
		const document  = load("the-seeker");
		const authoring = reconcile("de", "playbooks", englishCatalog([document]), {}).toAuthoring();
		const sources   = Object.values(authoring[document.system.slug]).map(e => e.source);

		expect(sources).not.toContain(document.system.slug);
		expect(sources).not.toContain(document._id);
		for (const move of document.system.moves) expect(sources).not.toContain(move);
		for (const region of document.system.origin) {
			for (const personalName of region.names) expect(sources).not.toContain(personalName);
		}
	});

	it("translates every playbook in the pack without a key collision", () => {
		const documents = ["the-blessed", "the-fox", "the-heavy", "the-judge", "the-lightbearer",
			"the-marshal", "the-ranger", "the-seeker", "the-would-be-hero"].map(load);

		const catalog = englishCatalog(documents); // throws on a duplicate key
		expect([...catalog.get("playbook").keys()].length).toBe(documents.length);

		for (const document of documents) {
			const strings = catalog.get("playbook").get(document.system.slug);
			expect(strings.get("name")).toBe(document.name);
			expect(strings.size).toBeGreaterThan(20);
		}
	});

	// Babele resolves entries by _id first; every playbook must therefore have a committed one.
	it("gives every playbook a stable id for Babele to key on", () => {
		const documents = ["the-blessed", "the-fox", "the-heavy", "the-judge", "the-lightbearer",
			"the-marshal", "the-ranger", "the-seeker", "the-would-be-hero"].map(load);
		const ids = documents.map(d => d._id);

		expect(ids.every(id => typeof id === "string" && id.length > 0)).toBe(true);
		expect(new Set(ids).size).toBe(ids.length);
		expect(documentIdentities(documents).size).toBe(documents.length);
	});
});
