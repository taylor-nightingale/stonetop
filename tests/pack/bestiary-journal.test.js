import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";

// The bestiary lives in two packs that reference each other: the codex is a
// `bestiary` JournalEntryPage authored in the stonetop-bestiary-journal source
// dir (which ships inside the merged `stonetop-journal` pack), and the mechanical
// stat blocks are `monster` actors in stonetop-bestiary. This test guards the
// two-way wiring the generator produces:
//   • every page links its stat-block actors (system.statBlocks)
//   • every stat-block actor links its codex entry (system.entry)
// and asserts they agree, so a renamed/removed creature can't leave a dangler.

const SRC = path.resolve("packs/src");
const JOURNAL_DIR = path.join(SRC, "stonetop-bestiary-journal");
const ACTOR_DIR = path.join(SRC, "stonetop-bestiary");

const ACTOR_PACK = "Compendium.stonetop.stonetop-bestiary.Actor";
const JOURNAL_PACK = "Compendium.stonetop.stonetop-journal.JournalEntry";

async function readDocs(dir) {
	const out = [];
	async function walk(d) {
		for (const e of await fs.readdir(d, { withFileTypes: true })) {
			if (e.name === "_folders") continue;
			const full = path.join(d, e.name);
			if (e.isDirectory()) await walk(full);
			else if (e.name.endsWith(".json")) out.push({ file: path.relative(SRC, full), doc: JSON.parse(await fs.readFile(full, "utf8")) });
		}
	}
	await walk(dir);
	return out;
}

let entries, actors, actorById, entryById;

beforeAll(async () => {
	entries = await readDocs(JOURNAL_DIR);
	actors = await readDocs(ACTOR_DIR);
	actorById = new Map(actors.map(({ doc }) => [doc._id, doc]));
	entryById = new Map(entries.map(({ doc }) => [doc._id, doc]));
});

describe("bestiary journal ↔ actor cross-links", () => {
	it("found both packs", () => {
		expect(entries.length).toBeGreaterThan(0);
		expect(actors.length).toBeGreaterThan(0);
	});

	it("every journal entry has exactly one `bestiary` page", () => {
		const bad = entries.filter(({ doc }) =>
			!Array.isArray(doc.pages) || doc.pages.length !== 1 || doc.pages[0].type !== "bestiary"
		);
		expect(bad.map(b => b.file)).toEqual([]);
	});

	it("every page's statBlocks resolve to actors that link back to this entry", () => {
		const bad = [];
		for (const { file, doc } of entries) {
			const entryUuid = `${JOURNAL_PACK}.${doc._id}`;
			const sbs = doc.pages?.[0]?.system?.statBlocks ?? [];
			// A lore-only entry (the book gives no stat block, e.g. the Manmarcher
			// Chief) intentionally links no actors; the actor→entry test below still
			// guards against orphaned stat blocks.
			if (!sbs.length) continue;
			for (const uuid of sbs) {
				const id = uuid.startsWith(`${ACTOR_PACK}.`) ? uuid.slice(ACTOR_PACK.length + 1) : null;
				const actor = id && actorById.get(id);
				if (!actor) bad.push(`${file}: statBlock ${uuid} not found in actor pack`);
				else if (actor.system?.entry !== entryUuid) bad.push(`${file}: actor ${id} entry=${actor.system?.entry} ≠ ${entryUuid}`);
			}
		}
		expect(bad).toEqual([]);
	});

	it("every monster actor links a journal entry that lists it back", () => {
		const bad = [];
		for (const { file, doc } of actors) {
			if (doc.type !== "monster") continue;
			const uuid = doc.system?.entry;
			const id = typeof uuid === "string" && uuid.startsWith(`${JOURNAL_PACK}.`) ? uuid.slice(JOURNAL_PACK.length + 1) : null;
			const entry = id && entryById.get(id);
			if (!entry) { bad.push(`${file}: entry ${uuid} not found in journal pack`); continue; }
			const sbs = entry.pages?.[0]?.system?.statBlocks ?? [];
			if (!sbs.includes(`${ACTOR_PACK}.${doc._id}`)) bad.push(`${file}: not listed in entry ${id}'s statBlocks`);
		}
		expect(bad).toEqual([]);
	});

	it("no monster actor carries leftover codex fields (codex moved to the page)", () => {
		const CODEX = ["description", "questions", "lore", "hooks", "origins", "discoveries", "nests", "dangers"];
		const bad = actors.filter(({ doc }) => doc.type === "monster" && CODEX.some(k => doc.system?.[k] !== undefined));
		expect(bad.map(b => b.file)).toEqual([]);
	});

	// The generator links the "Fae nature" special-quality shorthand to The Fae lore
	// entry so a reader can jump to the full rules. Guards against a new Fae stat
	// block (or a dropped link after an edit) leaving the term un-linked.
	it("every stat block mentioning 'Fae nature' links it to The Fae lore entry", async () => {
		const lore = JSON.parse(await fs.readFile(path.join(SRC, "stonetop-lore", "factions", "the-fae.json"), "utf8"));
		const expected = `@UUID[${JOURNAL_PACK}.${lore._id}]{Fae nature}`;
		const bad = actors.filter(({ doc }) =>
			doc.type === "monster" && (doc.system?.qualities ?? "").includes("Fae nature") && !doc.system.qualities.includes(expected)
		);
		expect(bad.map(b => b.file)).toEqual([]);
	});
});
