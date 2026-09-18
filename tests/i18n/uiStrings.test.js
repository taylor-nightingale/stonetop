import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EntryStatus } from "../../scripts/i18n/reconcile.js";
import { summarise } from "../../scripts/i18n/report.js";
import {
	UI_PACK,
	UiStringWorklist,
	flattenStrings,
	reconcileUiStrings,
	uiAuthoring,
	uiEnglishCatalog,
} from "../../scripts/i18n/uiStrings.js";

// reconcileUiStrings reads the two language files off disk, so it is exercised over a real (tiny)
// tree: the whole point is the disk → verdict path.
let root;

function buildRoot(en, de) {
	root = mkdtempSync(path.join(tmpdir(), "i18n-ui-"));
	mkdirSync(path.join(root, "languages", "compendium", "de"), { recursive: true });
	writeFileSync(path.join(root, "languages", "en.json"), JSON.stringify(en));
	if (de) writeFileSync(path.join(root, "languages", "de.json"), JSON.stringify(de));
	return root;
}

afterEach(() => {
	if (root) rmSync(root, { recursive: true, force: true });
	root = null;
});

const statuses = (result) => Object.fromEntries(Object.values(EntryStatus)
	.map(status => [status, result.countOf(status)])
	.filter(([, n]) => n));

describe("flattenStrings", () => {
	it("addresses every leaf by the dotted key game.i18n is called with", () => {
		expect([...flattenStrings({ stonetop: { steading: { attr: { prosperity: "Prosperity" } } } })])
			.toEqual([["stonetop.steading.attr.prosperity", "Prosperity"]]);
	});

	it("walks every root, not just the system's own", () => {
		const flat = flattenStrings({ TYPES: { Actor: { steading: "Steading" } }, stonetop: { a: "A" } });
		expect([...flat.keys()]).toEqual(["TYPES.Actor.steading", "stonetop.a"]);
	});

	// buildBabele generates this subtree into the language file from the tag authoring file, and it
	// is already reported as its own pack. Counting it here would double it — and because en.json
	// deliberately carries no tag labels, every German one would read as an orphan.
	it("leaves the generated tagLabels subtree out", () => {
		const flat = flattenStrings({ stonetop: { tagLabels: { group: "Gruppe" }, sheet: { save: "Save" } } });
		expect([...flat.keys()]).toEqual(["stonetop.sheet.save"]);
	});

	it("ignores anything that is not a string, which is a mistake in the file rather than work", () => {
		expect([...flattenStrings({ a: 7, b: null, c: ["x"], d: "D" }).keys()]).toEqual(["d"]);
	});

	it("is empty for an absent file", () => {
		expect(flattenStrings(undefined).size).toBe(0);
	});
});

describe("uiAuthoring", () => {
	// A language file records only the translated string, so the English it was written against has
	// to come from en.json. Stamping the CURRENT English is what makes a present translation read as
	// translated: without an authoring file there is nothing to prove it is stale.
	it("stamps the current English as the source of each translation", () => {
		const english = new Map([["a", "Alpha"]]);
		expect(uiAuthoring(english, new Map([["a", "Alfa"]])))
			.toEqual({ _ui: { a: { source: "Alpha", text: "Alfa" } } });
	});

	it("leaves a key the English no longer has without a source, so it reads as an orphan", () => {
		expect(uiAuthoring(new Map(), new Map([["gone", "Weg"]])))
			.toEqual({ _ui: { gone: { source: undefined, text: "Weg" } } });
	});
});

describe("uiEnglishCatalog", () => {
	it("shapes the strings the way reconcile consumes them", () => {
		const english = new Map([["a", "Alpha"]]);
		expect(uiEnglishCatalog(english).get("_ui").get("_ui")).toBe(english);
	});
});

describe("reconcileUiStrings", () => {
	it("counts a present translation as translated", async () => {
		buildRoot({ stonetop: { a: "Alpha" } }, { stonetop: { a: "Alfa" } });
		expect(statuses(await reconcileUiStrings("de", root))).toEqual({ translated: 1 });
	});

	// The bug this whole module exists for: a key added to en.json and never added to de.json falls
	// back to English at runtime, silently.
	it("counts a key missing from the language file as untranslated", async () => {
		buildRoot({ stonetop: { a: "Alpha", b: "Beta" } }, { stonetop: { a: "Alfa" } });
		expect(statuses(await reconcileUiStrings("de", root))).toEqual({ translated: 1, untranslated: 1 });
	});

	it("counts a translation the English no longer has as orphaned", async () => {
		buildRoot({ stonetop: { a: "Alpha" } }, { stonetop: { a: "Alfa", gone: "Weg" } });
		expect(statuses(await reconcileUiStrings("de", root))).toEqual({ translated: 1, orphaned: 1 });
	});

	// An orphan is what fails the check, so it has to carry the address the triage file uses.
	it("reports an orphan under the ui pack, so it can be acknowledged by address", async () => {
		buildRoot({ stonetop: { a: "Alpha" } }, { stonetop: { a: "Alfa", gone: "Weg" } });
		const [flagged] = (await reconcileUiStrings("de", root)).flaggedEntries;
		expect(flagged.pack).toBe(UI_PACK);
		expect(flagged.entry.key).toBe("stonetop.gone");
		expect(flagged.entry.status).toBe(EntryStatus.ORPHANED);
	});

	// A language file stores no record of the English a string was translated against, so drift
	// cannot be proven and is deliberately not guessed at. See the note in uiStrings.js.
	it("never reports drift, because a language file cannot prove it", async () => {
		buildRoot({ stonetop: { a: "Something else entirely" } }, { stonetop: { a: "Alfa" } });
		expect(statuses(await reconcileUiStrings("de", root))).toEqual({ translated: 1 });
	});

	it("treats a missing language file as everything untranslated", async () => {
		buildRoot({ stonetop: { a: "Alpha", b: "Beta" } }, null);
		expect(statuses(await reconcileUiStrings("de", root))).toEqual({ untranslated: 2 });
	});

	it("reports beside the packs, in the same words", async () => {
		buildRoot({ stonetop: { a: "Alpha", b: "Beta" } }, { stonetop: { a: "Alfa" } });
		expect(summarise(await reconcileUiStrings("de", root)))
			.toBe("de/ui: 1/2 translated (50%), 1 untranslated, 0 needing review, 0 orphaned");
	});
});

describe("UiStringWorklist", () => {
	const worklistFor = async (en, de) => {
		buildRoot(en, de);
		return UiStringWorklist.from("de", await reconcileUiStrings("de", root));
	};

	it("lists exactly the keys with no translation", async () => {
		const list = await worklistFor({ stonetop: { a: "Alpha", b: "Beta" } }, { stonetop: { a: "Alfa" } });
		expect(list.entries).toEqual([{ key: "stonetop.b", english: "Beta" }]);
	});

	it("carries the English, which is what a translator works from", async () => {
		const list = await worklistFor({ stonetop: { steading: { lists: { resources: "Resources" } } } }, {});
		expect(list.toMarkdown()).toContain('`"stonetop.steading.lists.resources"` — "Resources"');
	});

	it("groups by the parent path, so one section of the sheet is read at a time", async () => {
		const list = await worklistFor({ stonetop: { a: { x: "X", y: "Y" }, b: { z: "Z" } } }, {});
		expect([...list.byGroup().keys()]).toEqual(["stonetop.a", "stonetop.b"]);
		expect(list.byGroup().get("stonetop.a")).toHaveLength(2);
	});

	it("names the file the translator edits, which is not the one the packs use", async () => {
		const list = await worklistFor({ stonetop: { a: "Alpha" } }, {});
		expect(list.file).toBe("languages/de.json");
		expect(list.toMarkdown()).toContain("## languages/de.json");
	});

	it("renders nothing at all when there is nothing left to write", async () => {
		const list = await worklistFor({ stonetop: { a: "Alpha" } }, { stonetop: { a: "Alfa" } });
		expect(list.size).toBe(0);
		expect(list.toMarkdown()).toBe("");
	});

	it("counts itself in the summary line", async () => {
		const list = await worklistFor({ stonetop: { a: "Alpha", b: "Beta" } }, {});
		expect(list.summaryLine).toContain("**2**");
	});
});
