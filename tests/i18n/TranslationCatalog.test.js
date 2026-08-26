import { describe, expect, it } from "vitest";
import { TranslationCatalog } from "../../src/i18n/TranslationCatalog.js";

function germanCatalog() {
	return TranslationCatalog.fromTranslations({
		playbook: {
			"the-seeker": {
				"name": "Der Sucher",
				"description": "Seht uns an.",
				"backgrounds/patriot/label": "Patriot",
				"backgrounds/patriot/description": "Diese Leute sind Familie.",
				"choices/arcana-major/where-acquired/text": "Wo hast du es erworben?",
			},
		},
	});
}

function seekerDocument() {
	return {
		type: "playbook",
		name: "The Seeker",
		system: {
			slug: "the-seeker",
			description: "Look at us.",
			statsNote: "+2, +1, +1, +0, +0, -1",
			backgrounds: [{ slug: "patriot", label: "Patriot", description: "These people are family." }],
			choices: [{ slug: "arcana-major", list: [
				{ slug: "where-acquired", content: { text: "Where did you acquire it?" } },
			] }],
		},
	};
}

describe("fromTranslations", () => {
	it("is empty for absent, malformed or unknown-type input", () => {
		expect(TranslationCatalog.fromTranslations(undefined).isEmpty).toBe(true);
		expect(TranslationCatalog.fromTranslations({ playbook: "nope" }).isEmpty).toBe(true);
		expect(TranslationCatalog.fromTranslations({ move: { x: { name: "y" } } }).isEmpty).toBe(true);
	});

	it("drops blank and non-string values, and documents left with nothing", () => {
		const catalog = TranslationCatalog.fromTranslations({
			playbook: { "the-fox": { name: "  ", description: 7, statsNote: "gut" }, "the-heavy": { name: "" } },
		});
		expect(catalog.stringsFor("playbook", "the-fox")).toEqual({ statsNote: "gut" });
		expect(catalog.stringsFor("playbook", "the-heavy")).toBeNull();
	});

	it("has no strings for an unknown slug or a missing one", () => {
		const catalog = germanCatalog();
		expect(catalog.stringsFor("playbook", "the-judge")).toBeNull();
		expect(catalog.stringsFor("playbook", null)).toBeNull();
	});
});

describe("applyTo", () => {
	it("translates the name and nested prose in place", () => {
		const doc = seekerDocument();
		germanCatalog().applyTo(doc);
		expect(doc.name).toBe("Der Sucher");
		expect(doc.system.description).toBe("Seht uns an.");
		expect(doc.system.backgrounds[0].description).toBe("Diese Leute sind Familie.");
		expect(doc.system.choices[0].list[0].content.text).toBe("Wo hast du es erworben?");
	});

	it("leaves strings the catalog has no entry for in English", () => {
		const doc = seekerDocument();
		germanCatalog().applyTo(doc);
		expect(doc.system.statsNote).toBe("+2, +1, +1, +0, +0, -1");
	});

	it("never touches structure", () => {
		const doc = seekerDocument();
		germanCatalog().applyTo(doc);
		expect(doc.system.slug).toBe("the-seeker");
		expect(doc.system.backgrounds[0].slug).toBe("patriot");
		expect(doc.system.choices[0].slug).toBe("arcana-major");
		expect(doc.system.choices[0].list[0].slug).toBe("where-acquired");
	});

	it("addresses rows by slug, so a reordered document still translates correctly", () => {
		const doc = seekerDocument();
		doc.system.backgrounds.unshift({ slug: "antiquarian", label: "Antiquarian", description: "Secrets." });
		germanCatalog().applyTo(doc);
		expect(doc.system.backgrounds[0].description).toBe("Secrets.");
		expect(doc.system.backgrounds[1].description).toBe("Diese Leute sind Familie.");
	});

	it("does nothing for an empty catalog, an untranslated type or an untranslated document", () => {
		const untouched = seekerDocument();
		new TranslationCatalog().applyTo(untouched);
		expect(untouched.name).toBe("The Seeker");

		const otherType = { ...seekerDocument(), type: "move" };
		germanCatalog().applyTo(otherType);
		expect(otherType.name).toBe("The Seeker");

		const otherSlug = seekerDocument();
		otherSlug.system.slug = "the-judge";
		germanCatalog().applyTo(otherSlug);
		expect(otherSlug.name).toBe("The Seeker");
	});

	it("is idempotent across repeated data preparation", () => {
		const doc = seekerDocument();
		const catalog = germanCatalog();
		catalog.applyTo(doc);
		catalog.applyTo(doc);
		expect(doc.name).toBe("Der Sucher");
		expect(doc.system.backgrounds[0].description).toBe("Diese Leute sind Familie.");
	});

	it("tolerates a document with no system data", () => {
		expect(() => germanCatalog().applyTo({ type: "playbook" })).not.toThrow();
		expect(() => germanCatalog().applyTo(null)).not.toThrow();
	});
});

describe("localizedIndexEntry", () => {
	const entry = () => ({ _id: "abc", type: "playbook", name: "The Seeker", system: { slug: "the-seeker" } });

	it("translates the name without mutating core's index entry", () => {
		const original = entry();
		const localized = germanCatalog().localizedIndexEntry(original);
		expect(localized.name).toBe("Der Sucher");
		expect(original.name).toBe("The Seeker");
		expect(localized._id).toBe("abc");
		expect(localized.system.slug).toBe("the-seeker");
	});

	it("returns the entry untouched when nothing translates it", () => {
		const original = entry();
		expect(new TranslationCatalog().localizedIndexEntry(original)).toBe(original);
		expect(germanCatalog().localizedIndexEntry({ ...original, system: { slug: "the-judge" } }).name)
			.toBe("The Seeker");
		expect(germanCatalog().localizedIndexEntry({ ...original, system: undefined }).name).toBe("The Seeker");
	});

	it("passes a nullish entry straight through", () => {
		expect(germanCatalog().localizedIndexEntry(null)).toBeNull();
	});
});

describe("current", () => {
	it("starts empty so anything rendered before i18nInit shows English", () => {
		expect(TranslationCatalog.current.isEmpty).toBe(true);
	});
});
