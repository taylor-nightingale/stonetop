import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";

// Where an outfit item is FILED is what it is to a character sheet, not just how it's shelved for a
// human browsing the compendium:
//
//   Default/        the Inventory insert (printed p. 142) — the checklist every sheet draws in full
//   Special items/  everything else Book I prices (pp. 92-97) — a catalog a GM drags from
//
// An item in Default is a permanent row on EVERY character, which nobody can remove because nobody
// granted it. That is how 46 rows of the value tables once reached every sheet in the world: the
// builder wrote every priced object it couldn't already find, straight into the list the sheet reads.
//
// scripts/import/build-items.js reconciles Default against the parsed insert on every run; this is
// the same invariant checked from the committed tree, with no PDF.

const DIR = "packs/src/outfit-items";
const INSERT_GROUPS = ["armor", "basics", "sundries", "supplies", "travel", "warmth", "weapons"];
const DEFAULT_FOLDER_ID = "StOnEtOpDef0001X";   // what FoundryOutfitItemRepository filters on

describe("outfit-items: Default is the Inventory insert", () => {
	let items, folders;
	beforeAll(async () => { ({ items, folders } = await loadPack()); });

	it("splits the pack in two at the top level", () => {
		expect([...new Set(items.map(i => i.root))].sort()).toEqual(["default", "special"]);
	});

	it("files the insert's gear under Default, in its seven printed groups", () => {
		const groups = [...new Set(items.filter(i => i.root === "default").map(i => i.group))].sort();
		expect(groups).toEqual(INSERT_GROUPS);
	});

	// The count the printed insert lists. A row appearing here without one appearing on p. 142 is the
	// regression this whole guard exists for.
	it("holds exactly the insert's rows in Default", () => {
		expect(items.filter(i => i.root === "default")).toHaveLength(53);
	});

	it("keeps the catalog out of Default", () => {
		expect(items.filter(i => i.root === "special").length).toBeGreaterThan(40);
	});

	// The repository resolves membership by walking a folder's parents to this id, so the doc has to
	// exist, be named Default, and be a root.
	it("gives Default a stable root folder the sheet can filter on", () => {
		const def = folders.find(f => f.doc._id === DEFAULT_FOLDER_ID);
		expect(def, `no folder ${DEFAULT_FOLDER_ID}`).toBeDefined();
		expect(def.doc.name).toBe("Default");
		expect(def.doc.folder).toBeNull();
	});

	it("parents every insert group to Default, so the walk terminates there", () => {
		const groups = folders.filter(f => f.root === "default");
		expect(groups.map(f => f.doc.name.toLowerCase()).sort()).toEqual(INSERT_GROUPS);
		for (const f of groups) expect(f.doc.folder, f.file).toBe(DEFAULT_FOLDER_ID);
	});

	it("gives every item a slug and an inventory column, since the sheet renders it by both", () => {
		for (const i of items) {
			expect(i.doc.system?.slug, `${i.file} slug`).toBeTruthy();
			expect(["regular", "small"], `${i.file} column`).toContain(i.doc.system?.inventoryColumn);
		}
	});

	it("has no two items claiming the same slug", () => {
		const bySlug = new Map();
		for (const i of items) {
			const slug = i.doc.system.slug;
			expect(bySlug.get(slug), `${slug} is in both ${bySlug.get(slug)} and ${i.file}`).toBeUndefined();
			bySlug.set(slug, i.file);
		}
	});
});

async function loadPack() {
	const items = [], folders = [];
	const walk = async (rel) => {
		for (const entry of await fs.readdir(path.join(DIR, rel), { withFileTypes: true })) {
			const child = rel ? path.join(rel, entry.name) : entry.name;
			if (entry.isDirectory()) { await walk(child); continue; }
			if (!entry.name.endsWith(".json")) continue;
			const parts = child.split(path.sep);
			const doc = JSON.parse(await fs.readFile(path.join(DIR, child), "utf8"));
			const record = { file: child, root: parts[0], group: parts.at(-2), doc };
			(parts.includes("_folders") ? folders : items).push(record);
		}
	};
	await walk("");
	return { items, folders };
}
