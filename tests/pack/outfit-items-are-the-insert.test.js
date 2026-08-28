import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { INVENTORY_INSERT_PAGE } from "../../src/model/data/character/inventoryInsertPage.js";

// What a character sheet draws is the inventory PAGE (src/model/data/character/inventoryInsertPage.js),
// which names Book I p. 142's rows by slug. The compendium is the catalog behind it: every gear object
// Book I prices (pp. 92-97), filed into folders that are shelving for a human browsing them and nothing
// more.
//
// That split is the whole point. Membership used to be "filed under the Default folder", which is how
// 46 rows of the value tables once became a permanent row on every character in the world — one nobody
// could remove, because nobody had granted it. A row is on the sheet now because the page lists it, and
// the page is one readable file.
//
// scripts/import/build-items.js re-reads p. 142 and checks the page against it — names AND order — on
// every run. This checks the page against the committed catalog, with no PDF.

const DIR = "packs/src/outfit-items";
const INSERT_FOLDER_ID = "StOnEtOpDef0001X";

describe("outfit-items: the page and the catalog agree", () => {
	let items, folders;
	beforeAll(async () => { ({ items, folders } = await loadPack()); });

	const pageSlugs = () => INVENTORY_INSERT_PAGE.slugs;

	it("lists the 53 rows the insert prints", () => {
		expect(pageSlugs()).toHaveLength(53);
	});

	it("names no row twice", () => {
		expect(new Set(pageSlugs()).size).toBe(pageSlugs().length);
	});

	// A slug with no item behind it renders as nothing at all — a silently missing row on every sheet.
	it("names only gear the catalog actually holds", () => {
		const inCatalog = new Set(items.map(i => i.doc.system?.slug));
		expect(pageSlugs().filter(slug => !inCatalog.has(slug))).toEqual([]);
	});

	it("splits the page into the two printed columns", () => {
		expect(INVENTORY_INSERT_PAGE.columns.map(c => c.key)).toEqual(["regular", "small"]);
	});

	// The whitespace breaks the insert sets between its groups are what the sheet rules between.
	it("keeps the printed groups: five in the load column, two in the small one", () => {
		expect(INVENTORY_INSERT_PAGE.column("regular").sections).toHaveLength(5);
		expect(INVENTORY_INSERT_PAGE.column("small").sections).toHaveLength(2);
	});

	it("opens the load column with the supplies, and prints the page's prose under them", () => {
		const [supplies] = INVENTORY_INSERT_PAGE.column("regular").sections;
		expect(supplies.slugs).toEqual(["supplies", "more-supplies", "even-more-supplies"]);
		expect(supplies.note).toBe("stonetop.inventory.supplies.note");
	});

	// The shelf is only shelving now, but a shelf that quietly disagrees with the page is still drift.
	it("shelves exactly the page's gear under the insert folder", () => {
		const shelved = items.filter(i => i.root === "default").map(i => i.doc.system?.slug);
		expect(shelved.slice().sort()).toEqual(pageSlugs().slice().sort());
	});

	it("keeps the catalog Book I prices behind it", () => {
		expect(items.filter(i => i.root === "special").length).toBeGreaterThan(40);
	});

	it("gives the insert shelf a stable root folder", () => {
		const shelf = folders.find(f => f.doc._id === INSERT_FOLDER_ID);
		expect(shelf, `no folder ${INSERT_FOLDER_ID}`).toBeDefined();
		expect(shelf.doc.folder).toBeNull();
	});

	it("gives every item a slug, since the page names its rows by one", () => {
		for (const i of items) expect(i.doc.system?.slug, `${i.file} slug`).toBeTruthy();
	});

	// Off-page gear still says which column it lands in; the page places only its own rows.
	it("gives every item an inventory column", () => {
		for (const i of items)
			expect(["regular", "small"], `${i.file} column`).toContain(i.doc.system?.inventoryColumn);
	});

	it("has no two items claiming the same slug", () => {
		const bySlug = new Map();
		for (const i of items) {
			const slug = i.doc.system.slug;
			expect(bySlug.get(slug), `${slug} is in both ${bySlug.get(slug)} and ${i.file}`).toBeUndefined();
			bySlug.set(slug, i.file);
		}
	});

	// `name` is the item, `system.qualifier` what qualifies it — never one repeating the other.
	it("keeps the item's own name out of its qualifier", () => {
		for (const i of items) {
			const { name, doc } = { name: i.doc.name, doc: i.doc };
			expect(name, `${i.file} name`).not.toMatch(/,/);
			expect(doc.system.qualifier ?? "", `${i.file} qualifier`).not.toContain(name);
		}
	});

	it("no longer stores a two-column flag — layout is the page's", () => {
		for (const i of items) expect(i.doc.system, i.file).not.toHaveProperty("twoCol");
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
