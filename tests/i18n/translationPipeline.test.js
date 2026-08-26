import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { englishCatalog } from "../../scripts/i18n/packCatalog.js";
import { reconcile } from "../../scripts/i18n/reconcile.js";
import { TranslationCatalog } from "../../src/i18n/TranslationCatalog.js";

// End-to-end over real pack data: extract → translate → compile → apply at runtime.
//
// The build and the runtime derive translation keys from the same module, and nothing else checks
// that they agree. If they ever drift apart every translation silently stops resolving, and the
// symptom — English text — looks exactly like an untranslated string.

const seeker = () => JSON.parse(readFileSync("packs/src/playbooks/the-seeker.json", "utf8"));

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

function compile(document, authoring) {
	const result = reconcile("de", "playbooks", englishCatalog([document]), authoring);
	return TranslationCatalog.fromTranslations(result.toRuntime());
}

describe("the translation pipeline, over the real playbooks pack", () => {
	const KEYS = [
		"name",
		"description",
		"backgrounds/patriot/description",
		"choices/arcana-major/where-acquired/text",
	];

	it("resolves at runtime every key the extractor produced", () => {
		const document = seeker();
		const catalog  = compile(document, authoringFor(document, KEYS, en => `[de] ${en}`));

		catalog.applyTo(document);

		expect(document.name).toBe("[de] The Seeker");
		expect(document.system.description.startsWith("[de] Look at us.")).toBe(true);
		expect(document.system.backgrounds.find(b => b.slug === "patriot").description.startsWith("[de] ")).toBe(true);
		const group = document.system.choices.find(g => g.slug === "arcana-major");
		expect(group.list.find(e => e.slug === "where-acquired").content.text)
			.toBe("[de] Where did you acquire it?");
	});

	it("leaves everything the translator did not touch in English", () => {
		const document = seeker();
		const before   = seeker();
		compile(document, authoringFor(document, ["name"], () => "Der Sucher")).applyTo(document);

		expect(document.name).toBe("Der Sucher");
		expect(document.system).toEqual(before.system);
	});

	it("carries no structure into the translation file", () => {
		const document = seeker();
		const authoring = reconcile("de", "playbooks", englishCatalog([document]), {}).toAuthoring();
		const sources = Object.values(authoring[document.system.slug]).map(e => e.source);

		expect(sources).not.toContain(document.system.slug);
		expect(sources).not.toContain(document._id);
		for (const move of document.system.moves) expect(sources).not.toContain(move);
		for (const region of document.system.origin) {
			for (const personalName of region.names) expect(sources).not.toContain(personalName);
		}
	});

	it("translates every playbook in the pack without a key collision", () => {
		const documents = ["the-blessed", "the-fox", "the-heavy", "the-judge", "the-lightbearer",
			"the-marshal", "the-ranger", "the-seeker", "the-would-be-hero"]
			.map(slug => JSON.parse(readFileSync(`packs/src/playbooks/${slug}.json`, "utf8")));

		const catalog = englishCatalog(documents); // throws on a duplicate key
		expect([...catalog.get("playbook").keys()].length).toBe(documents.length);

		for (const document of documents) {
			const strings = catalog.get("playbook").get(document.system.slug);
			expect(strings.get("name")).toBe(document.name);
			expect(strings.size).toBeGreaterThan(20);
		}
	});
});
