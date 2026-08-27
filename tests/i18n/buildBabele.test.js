import { describe, expect, it } from "vitest";
import { babeleFilePath, babeleTranslationFile, documentIdentities } from "../../scripts/i18n/buildBabele.js";
import { CONVERTER_NAME } from "../../src/i18n/babeleConverter.js";
import { FOLDER_SLUG, FOLDER_TYPE, folderCatalog } from "../../scripts/i18n/packCatalog.js";

const DOCS = [
	{ _id: "aaa111", type: "playbook", name: "The Seeker", system: { slug: "the-seeker" } },
	{ _id: "bbb222", type: "playbook", name: "The Fox",    system: { slug: "the-fox" } },
];

const identities = () => documentIdentities(DOCS);

describe("documentIdentities", () => {
	it("indexes documents by slug", () => {
		expect(identities().get("the-seeker")).toEqual({ id: "aaa111", name: "The Seeker" });
	});

	it("skips documents with no slug or no id", () => {
		const found = documentIdentities([
			{ _id: "ccc", type: "playbook", system: {} },
			{ type: "playbook", system: { slug: "no-id" } },
		]);
		expect(found.size).toBe(0);
	});
});

describe("babeleTranslationFile", () => {
	const runtime = { playbook: { "the-seeker": {
		name: "Der Sucher",
		"backgrounds/patriot/label": "Patriotin",
	} } };

	// Babele resolves _id → name → sourceId. Ids in packs/src are stable and committed, so an
	// English rename cannot detach the translation.
	it("keys entries by document _id, not by name", () => {
		const file = babeleTranslationFile("Playbooks", runtime, identities());
		expect(Object.keys(file.entries)).toEqual(["aaa111"]);
	});

	it("splits the document name out from the system strings", () => {
		const { entries } = babeleTranslationFile("Playbooks", runtime, identities());
		expect(entries.aaa111).toEqual({
			name: "Der Sucher",
			stonetop: { "backgrounds/patriot/label": "Patriotin" },
		});
	});

	it("carries the mapping block that routes system through our converter", () => {
		const file = babeleTranslationFile("Playbooks", runtime, identities());
		expect(file.label).toBe("Playbooks");
		expect(file.mapping).toEqual({ name: "name", stonetop: { path: "system", converter: CONVERTER_NAME } });
	});

	it("omits name when only system strings are translated, and vice versa", () => {
		const nameOnly = babeleTranslationFile("P", { playbook: { "the-fox": { name: "Der Fuchs" } } }, identities());
		expect(nameOnly.entries.bbb222).toEqual({ name: "Der Fuchs" });

		const systemOnly = babeleTranslationFile("P", { playbook: { "the-fox": { statsNote: "Verteile" } } }, identities());
		expect(systemOnly.entries.bbb222).toEqual({ stonetop: { statsNote: "Verteile" } });
	});

	it("skips a slug with no document in the pack", () => {
		const file = babeleTranslationFile("P", { playbook: { "the-judge": { name: "x" } } }, identities());
		expect(file.entries).toEqual({});
	});

	it("emits an empty entry set when nothing is translated", () => {
		expect(babeleTranslationFile("P", {}, identities()).entries).toEqual({});
	});
});

describe("babeleFilePath", () => {
	// Where setSystemTranslationsDir("babele") makes Babele look:
	// systems/<system>/babele/<language>/<pack collection>.json
	it("matches the layout Babele resolves for a system's own translations", () => {
		expect(babeleFilePath("de", "playbooks")).toBe("babele/de/stonetop.playbooks.json");
	});
});

describe("folder translations", () => {
	const folders = () => folderCatalog([{ name: "Major Arcana" }, { name: "Minor Arcana" }]);
	const runtime = translated => ({
		arcanum: { "rune-laden-scales": { name: "Runenbeschriftete Schuppen" } },
		[FOLDER_TYPE]: { [FOLDER_SLUG]: translated },
	});

	// Babele's folder-translations.js reads `compendium.folders`, keyed by the folder's ORIGINAL
	// name. The authoring file keys by the slugified name, so the build maps one to the other.
	it("emits folders keyed by their original name", () => {
		const file = babeleTranslationFile("Arcana", runtime({ "major-arcana": "Große Arkana" }), new Map(), folders());
		expect(file.folders).toEqual({ "Major Arcana": "Große Arkana" });
	});

	it("omits the folders key when none are translated", () => {
		const file = babeleTranslationFile("Arcana", runtime({}), new Map(), folders());
		expect(file.folders).toBeUndefined();
		expect(babeleTranslationFile("Arcana", {}, new Map()).folders).toBeUndefined();
	});

	it("ignores a translation for a folder the pack no longer has", () => {
		const file = babeleTranslationFile("Arcana", runtime({ "gone-folder": "Weg" }), new Map(), folders());
		expect(file.folders).toBeUndefined();
	});

	it("keeps folders out of the document entries", () => {
		const identities = documentIdentities([{ _id: "zzz", type: "arcanum", system: { slug: "rune-laden-scales" } }]);
		const file = babeleTranslationFile("Arcana", runtime({ "major-arcana": "Große Arkana" }), identities, folders());
		expect(Object.keys(file.entries)).toEqual(["zzz"]);
	});
});

describe("folderCatalog", () => {
	it("keys folders by their slugified name", () => {
		expect([...folderCatalog([{ name: "Major Arcana" }]).entries()]).toEqual([["major-arcana", "Major Arcana"]]);
	});

	// Two folders sharing a name share a translation, which is what Babele does anyway — it looks
	// translations up by name, not by folder id.
	it("collapses folders that share a name, and skips nameless ones", () => {
		expect(folderCatalog([{ name: "Arcana" }, { name: "Arcana" }, {}, { name: "" }]).size).toBe(1);
	});
});
