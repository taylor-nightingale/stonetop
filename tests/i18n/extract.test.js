import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extract } from "../../scripts/i18n/extract.js";
import { TRANSLATED_PACKS } from "../../scripts/i18n/files.js";
import { AwaitingTranslator } from "../../scripts/i18n/awaiting.js";
import { check } from "../../scripts/i18n/check.js";

let root;

const move = (slug, description) => ({
	_id: slug, type: "move", name: slug, system: { slug, description },
});

/** A move that carries a tag, so tag label reconciliation has something to pick up. */
const moveWithTag = (slug, description, tag) => ({
	_id: slug, type: "move", name: slug, system: { slug, description }, tagList: [tag],
});

/** A root holding every pack directory the extract walks, with `docs` in the moves pack. */
function buildRoot(docs) {
	root = mkdtempSync(path.join(tmpdir(), "i18n-extract-"));
	for (const pack of TRANSLATED_PACKS) mkdirSync(path.join(root, "packs", "src", pack), { recursive: true });
	mkdirSync(path.join(root, "languages", "compendium", "de"), { recursive: true });
	for (const doc of docs) {
		writeFileSync(path.join(root, "packs", "src", "moves", `${doc.system.slug}.json`), JSON.stringify(doc));
	}
}

const writeAuthoring = (pack, data) =>
	writeFileSync(path.join(root, "languages", "compendium", "de", `${pack}.json`), JSON.stringify(data));

const readAwaiting = () => {
	const p = path.join(root, "languages", "compendium", "de", "_awaiting.json");
	return AwaitingTranslator.fromJson(JSON.parse(readFileSync(p, "utf8")));
};

afterEach(() => {
	if (root) rmSync(root, { recursive: true, force: true });
	root = undefined;
});

const writeLanguages = (en, de) => {
	writeFileSync(path.join(root, "languages", "en.json"), JSON.stringify(en));
	writeFileSync(path.join(root, "languages", "de.json"), JSON.stringify(de));
};

let logged;
beforeEach(() => {
	logged = [];
	vi.spyOn(console, "log").mockImplementation(line => logged.push(String(line)));
});

const output = () => logged.join("\n");

describe("extract", () => {
	it("writes _awaiting.json with flagged entries", async () => {
		buildRoot([move("aid", "New English.")]);
		writeAuthoring("moves", { aid: { description: { source: "Old English.", text: "Altes Deutsch." } } });

		await extract({ lang: "de", root });

		const awaiting = readAwaiting();
		expect(awaiting.size).toBe(1);
		expect(awaiting.has("moves", "aid", "description")).toBe(true);
	});

	it("writes empty _awaiting.json when nothing is flagged", async () => {
		buildRoot([move("aid", "Current English.")]);
		writeAuthoring("moves", { aid: { description: { source: "Current English.", text: "Aktuelles Deutsch." } } });

		await extract({ lang: "de", root });

		const awaiting = readAwaiting();
		expect(awaiting.size).toBe(0);
	});

	it("running check after extract passes", async () => {
		buildRoot([move("aid", "New English.")]);
		writeAuthoring("moves", { aid: { description: { source: "Old English.", text: "Altes Deutsch." } } });

		await extract({ lang: "de", root });
		expect(await check({ root })).toBe(true);
	});

	it("acknowledges tag label flagged entries in _awaiting.json", async () => {
		buildRoot([moveWithTag("aid", "English.", "Close")]);
		// The tag authoring is shaped as slug → key → {source, text}, where the slug is "_tags".
		// "Close" matches the tag from the pack; "Distant" has no pack source, so it is orphaned.
		writeAuthoring("tag-labels", {
			_tags: {
				close: { source: "Close", text: "Geschlossen" },
				distant: { source: "Distant", text: "Fern" },
			},
		});

		await extract({ lang: "de", root });

		const awaiting = readAwaiting();
		// "distant" is orphaned (no pack has that tag), so it should be acknowledged.
		expect(awaiting.has("tag-labels", "_tags", "distant")).toBe(true);
	});

	it("acknowledges UI string orphans in _awaiting.json", async () => {
		buildRoot([move("aid", "English.")]);
		writeLanguages({ stonetop: { a: "Alpha" } }, { stonetop: { a: "Alfa", gone: "Weg" } });

		await extract({ lang: "de", root });

		const awaiting = readAwaiting();
		expect(awaiting.has("ui", "_ui", "stonetop.gone")).toBe(true);
	});

	it("extracts all languages when no language is specified", async () => {
		buildRoot([move("aid", "New English.")]);
		writeAuthoring("moves", { aid: { description: { source: "Old English.", text: "Altes Deutsch." } } });
		// Create a second language directory so listLanguages finds two.
		mkdirSync(path.join(root, "languages", "compendium", "fr"), { recursive: true });
		writeAuthoring("moves", {});
		// Overwrite the moves authoring for fr (writeAuthoring overwrites the file).
		writeFileSync(path.join(root, "languages", "compendium", "fr", "moves.json"), JSON.stringify({}));

		const results = await extract({ root });

		// Results should contain reconciliations for both languages.
		const langs = new Set(results.map(r => r.lang));
		expect(langs).toContain("de");
		expect(langs).toContain("fr");
	});

	it("prints the corpus report when translations are reused", async () => {
		// Two moves with identical English will trigger the corpus "reused" fill.
		buildRoot([
			move("aid", "Identical English text."),
			move("defy-danger", "Identical English text."),
		]);
		// Only one has a translation; the other should be filled by the corpus.
		writeAuthoring("moves", {
			aid: { description: { source: "Identical English text.", text: "Deutsche Übersetzung." } },
		});

		await extract({ lang: "de", root });

		expect(output()).toContain("reused");
	});
});
