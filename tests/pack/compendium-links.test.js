import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { PACKS } from "../../scripts/compendium-pack/packs.js";

// A @UUID link is a raw document id typed into prose — nothing checks it until a player clicks a
// dead link in play. Pack ids are stable, so every link in the sources can be resolved against the
// sources: this catches a typo'd id, a link to a pack we don't ship, and a document deleted or
// regenerated with a new id while something still points at it.
//
// Page-level links (journal entries) are checked against the pages of the ENTRY they name, so a
// link can't drift onto a page that lives in some other entry.

const LINK_RE = /@UUID\[Compendium\.stonetop\.([a-z-]+)\.(\w+)\.([A-Za-z0-9]+)(?:\.(\w+)\.([A-Za-z0-9]+))?\]/g;

let docs;   // pack -> Map(docId -> Set(pageId))
let links;  // {file, pack, docId, pageId}[]

beforeAll(async () => {
	docs  = await loadDocs();
	links = await loadLinks();
});

describe("Compendium links in pack sources", () => {
	it("finds links to check", () => {
		expect(links.length).toBeGreaterThan(0);
	});

	it("every link names a pack this system ships", () => {
		expect(problems(l => !docs.has(l.pack), l => `unknown pack "${l.pack}"`)).toEqual([]);
	});

	it("every link resolves to a document in that pack", () => {
		expect(problems(
			l => docs.has(l.pack) && !docs.get(l.pack).has(l.docId),
			l => `no document ${l.docId} in ${l.pack}`,
		)).toEqual([]);
	});

	it("every page link resolves to a page of the entry it names", () => {
		expect(problems(
			l => l.pageId && docs.get(l.pack)?.has(l.docId) && !docs.get(l.pack).get(l.docId).has(l.pageId),
			l => `no page ${l.pageId} on ${l.pack} document ${l.docId}`,
		)).toEqual([]);
	});
});

// The move tells a dying character they can gain one of three inserts; each name is a link to it.
describe("Death's Door links its inserts", () => {
	let move, insertNames;

	beforeAll(async () => {
		move = JSON.parse(await fs.readFile(_src("moves/special/deaths-door.json"), "utf8"));
		insertNames = new Map(await Promise.all(
			[...docs.get("inserts").keys()].map(async id => [id, await _nameById("inserts", id)]),
		));
	});

	// Both places the text is printed: the sheet renders `description`, the chat card the 6- result.
	const linkedNames = (text) =>
		[...text.matchAll(LINK_RE)].map(m => insertNames.get(m[3]));

	it("links all three inserts from the description", () => {
		expect(linkedNames(move.system.description))
			.toEqual(["Revenant", "Ghost", "Thrall"]);
	});

	it("links all three inserts from the miss result too", () => {
		expect(linkedNames(move.system.moveResults.failure.value))
			.toEqual(["Revenant", "Ghost", "Thrall"]);
	});
});

// ── loading ───────────────────────────────────────────────────────────────────

function _src(rel) {
	return path.join(process.cwd(), "packs/src", rel);
}

function problems(isBad, describe_) {
	return links.filter(isBad).map(l => `${l.file}: ${describe_(l)}`);
}

async function _walk(dir) {
	const out = [];
	let entries;
	try {
		entries = await fs.readdir(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...await _walk(full));
		else if (entry.name.endsWith(".json") && !full.includes(`${path.sep}_folders${path.sep}`)) out.push(full);
	}
	return out;
}

async function loadDocs() {
	const byPack = new Map();
	for (const pack of PACKS) {
		const pages = new Map();
		for (const file of await _walk(_src(pack))) {
			const doc = JSON.parse(await fs.readFile(file, "utf8"));
			if (!doc._id) continue;
			pages.set(doc._id, new Set((doc.pages ?? []).map(p => p._id).filter(Boolean)));
		}
		byPack.set(pack, pages);
	}
	return byPack;
}

async function loadLinks() {
	const found = [];
	for (const pack of PACKS) {
		for (const file of await _walk(_src(pack))) {
			const text = await fs.readFile(file, "utf8");
			for (const [, targetPack, , docId, , pageId] of text.matchAll(LINK_RE)) {
				found.push({ file: path.relative(process.cwd(), file), pack: targetPack, docId, pageId });
			}
		}
	}
	return found;
}

async function _nameById(pack, id) {
	for (const file of await _walk(_src(pack))) {
		const doc = JSON.parse(await fs.readFile(file, "utf8"));
		if (doc._id === id) return doc.name;
	}
	return null;
}
