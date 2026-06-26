import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { SPECIAL_ITEM_CATALOG } from "../../module/data/special-items.js";

// The "Add Special Item" picker (SPECIAL_ITEM_CATALOG) and the inventory-items
// compendium must agree: every Flora & Herbs entry the picker offers has to map
// to a real item with a matching slug, name, and specialCategory — otherwise
// picking it adds nothing.

const INV_DIR = path.resolve("packs/src/stonetop-items/inventory-items");
const CATEGORY = "Flora & Herbs";

let bySlug; // slug -> { name, specialCategory }
let floraCatalog;

beforeAll(async () => {
	const files = (await fs.readdir(INV_DIR)).filter(f => f.endsWith(".json"));
	bySlug = new Map();
	for (const f of files) {
		const doc = JSON.parse(await fs.readFile(path.join(INV_DIR, f), "utf8"));
		const st = doc.flags?.stonetop ?? {};
		if (st.slug) bySlug.set(st.slug, { name: doc.name, specialCategory: st.specialCategory });
	}
	floraCatalog = SPECIAL_ITEM_CATALOG.find(c => c.category === CATEGORY)?.items ?? [];
});

describe("flora & herbs picker", () => {
	it("the catalog has the seven sample specimens", () => {
		expect(floraCatalog.map(i => i.slug).sort()).toEqual([
			"brightberry", "hartwood", "sleeping-elksheart", "snowembers",
			"twisting-pine", "vantas-blade", "violet-lotus",
		]);
	});

	it("every picker entry resolves to an inventory item with a matching name", () => {
		const bad = [];
		for (const entry of floraCatalog) {
			const item = bySlug.get(entry.slug);
			if (!item) bad.push(`${entry.slug}: no item`);
			else if (item.name !== entry.name) bad.push(`${entry.slug}: name "${item.name}" ≠ catalog "${entry.name}"`);
		}
		expect(bad).toEqual([]);
	});

	it("every flora item is tagged with the Flora & Herbs specialCategory", () => {
		const catalogSlugs = new Set(floraCatalog.map(i => i.slug));
		const bad = [];
		for (const slug of catalogSlugs) {
			if (bySlug.get(slug)?.specialCategory !== CATEGORY) bad.push(slug);
		}
		expect(bad).toEqual([]);
	});
});
