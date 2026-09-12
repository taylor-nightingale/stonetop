import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { check } from "../../scripts/i18n/check.js";
import { TRANSLATED_PACKS } from "../../scripts/i18n/files.js";

// check() reads packs and translation files off disk and decides an exit code, so it is exercised
// over a real (tiny) tree rather than mocked: the thing worth testing is exactly the disk → verdict
// path, and a stub of the filesystem would test nothing.

let root;

const move = (slug, description) => ({
	_id: slug, type: "move", name: slug, system: { slug, description },
});

/** A root holding every pack directory the check walks, with `docs` in the moves pack. */
function buildRoot(docs) {
	root = mkdtempSync(path.join(tmpdir(), "i18n-check-"));
	for (const pack of TRANSLATED_PACKS) mkdirSync(path.join(root, "packs", "src", pack), { recursive: true });
	mkdirSync(path.join(root, "languages", "compendium", "de"), { recursive: true });
	for (const doc of docs) {
		writeFileSync(path.join(root, "packs", "src", "moves", `${doc.system.slug}.json`), JSON.stringify(doc));
	}
}

const writeAuthoring = (pack, data) =>
	writeFileSync(path.join(root, "languages", "compendium", "de", `${pack}.json`), JSON.stringify(data));

const writeAwaiting = (data) =>
	writeFileSync(path.join(root, "languages", "compendium", "de", "_awaiting.json"), JSON.stringify(data));

/** The English moved on under a translation, which is what makes an entry need review. */
const driftedAuthoring = (slug) => ({ [slug]: { description: { source: "Old English.", text: "Altes Deutsch." } } });

let logged;
beforeEach(() => {
	logged = [];
	vi.spyOn(console, "log").mockImplementation(line => logged.push(String(line)));
	vi.spyOn(console, "error").mockImplementation(line => logged.push(String(line)));
});
afterEach(() => {
	vi.restoreAllMocks();
	if (root) rmSync(root, { recursive: true, force: true });
	root = undefined;
});

const output = () => logged.join("\n");

describe("check", () => {
	it("fails on drift nobody has acknowledged, and says it is new", async () => {
		buildRoot([move("aid", "New English.")]);
		writeAuthoring("moves", driftedAuthoring("aid"));

		expect(await check({ root })).toBe(false);
		expect(output()).toContain("needs review  aid description");
		expect(output()).toContain("de: 0 awaiting translator, 1 new");
	});

	it("passes once that entry is acknowledged, and still prints it", async () => {
		buildRoot([move("aid", "New English.")]);
		writeAuthoring("moves", driftedAuthoring("aid"));
		writeAwaiting({ moves: { aid: ["description"] } });

		expect(await check({ root })).toBe(true);
		expect(output()).toContain("awaiting translator  aid description");
		expect(output()).not.toContain("needs review  aid description");
		expect(output()).toContain("de: 1 awaiting translator, 0 new");
	});

	it("still fails on a second entry the acknowledgement does not cover", async () => {
		buildRoot([move("aid", "New English."), move("defy-danger", "New English.")]);
		writeAuthoring("moves", { ...driftedAuthoring("aid"), ...driftedAuthoring("defy-danger") });
		writeAwaiting({ moves: { aid: ["description"] } });

		expect(await check({ root })).toBe(false);
		expect(output()).toContain("awaiting translator  aid description");
		expect(output()).toContain("needs review  defy-danger description");
		expect(output()).toContain("de: 1 awaiting translator, 1 new");
	});

	it("acknowledges by full address, not by key alone", async () => {
		buildRoot([move("aid", "New English.")]);
		writeAuthoring("moves", driftedAuthoring("aid"));
		writeAwaiting({ moves: { "some-other-move": ["description"] } });

		expect(await check({ root })).toBe(false);
		expect(output()).toContain("needs review  aid description");
	});

	it("reports an acknowledgement the translator has since resolved, without failing", async () => {
		buildRoot([move("aid", "New English.")]);
		writeAuthoring("moves", { aid: { description: { source: "New English.", text: "Neues Deutsch." } } });
		writeAwaiting({ moves: { aid: ["description"] } });

		expect(await check({ root })).toBe(true);
		expect(output()).toContain("resolved      moves/aid description");
		expect(output()).toContain("remove it from _awaiting.json");
	});

	it("passes with no acknowledgement file at all when nothing has drifted", async () => {
		buildRoot([move("aid", "New English.")]);
		writeAuthoring("moves", { aid: { description: { source: "New English.", text: "Neues Deutsch." } } });

		expect(await check({ root })).toBe(true);
		expect(output()).toContain("de: 0 awaiting translator, 0 new");
	});
});
