import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { BEAST_CATALOG, BEAST_ORDER, BEAST_SLUGS } from "../../module/data/beasts.js";

// The Followers-tab beast cards and the Setting Overview journal's "Livestock &
// Other Beasts" links both hinge on the same contract: each beast slug maps to an
// inventory-items compendium entry, and the journal @UUID links carry that entry's
// real _id. These tests fail loudly if a slug, _id, or link drifts out of sync.

const INV_DIR = path.resolve("packs/src/stonetop-items/inventory-items");
const SETTING_OVERVIEW = path.resolve(
	"packs/src/stonetop-journals/setting-overview.json",
);

let slugToItem;     // slug -> { _id, name, specialCategory }
let livestockPage;  // the "Special Items" journal page content

beforeAll(async () => {
	const files = (await fs.readdir(INV_DIR)).filter(f => f.endsWith(".json"));
	slugToItem = new Map();
	for (const f of files) {
		const doc = JSON.parse(await fs.readFile(path.join(INV_DIR, f), "utf8"));
		const st  = doc.flags?.stonetop ?? {};
		if (st.slug) slugToItem.set(st.slug, { _id: doc._id, name: doc.name, specialCategory: st.specialCategory });
	}

	const journal = JSON.parse(await fs.readFile(SETTING_OVERVIEW, "utf8"));
	livestockPage = journal.pages.find(p => p.name === "Special Items")?.text?.content ?? "";
});

describe("beast catalog", () => {
	it("BEAST_ORDER and BEAST_CATALOG cover the same slugs", () => {
		expect([...BEAST_ORDER].sort()).toEqual(Object.keys(BEAST_CATALOG).sort());
	});

	it("BEAST_SLUGS matches BEAST_ORDER", () => {
		expect([...BEAST_SLUGS].sort()).toEqual([...BEAST_ORDER].sort());
	});

	it("follower beasts have a Cost; livestock do not", () => {
		for (const slug of BEAST_ORDER) {
			const b = BEAST_CATALOG[slug];
			if (b.follower) expect(b.cost, `${slug} should have a Cost`).toBeTruthy();
			else expect(b.cost, `${slug} should not have a Cost`).toBeFalsy();
		}
	});

	it("dog, mule, and horse are the follower beasts", () => {
		const followers = BEAST_ORDER.filter(s => BEAST_CATALOG[s].follower);
		expect(followers.sort()).toEqual(["dog-follower", "horse", "mule"]);
	});

	it("every beast has HP, damage, and at least one trait", () => {
		for (const slug of BEAST_ORDER) {
			const b = BEAST_CATALOG[slug];
			expect(Number.isFinite(b.hp), `${slug} hp`).toBe(true);
			expect(b.damage, `${slug} damage`).toMatch(/^d\d+([+-]\d+)?$/);
			expect(b.traits.length, `${slug} traits`).toBeGreaterThan(0);
		}
	});
});

describe("setting overview livestock links", () => {
	it("every beast slug resolves to an inventory item", () => {
		const missing = BEAST_ORDER.filter(s => !slugToItem.has(s));
		expect(missing).toEqual([]);
	});

	it("every beast item is tagged Livestock & Beasts", () => {
		const bad = BEAST_ORDER.filter(s => slugToItem.get(s)?.specialCategory !== "Livestock & Beasts");
		expect(bad).toEqual([]);
	});

	it("journal links each beast to its real inventory-item _id", () => {
		const missing = [];
		for (const slug of BEAST_ORDER) {
			const item = slugToItem.get(slug);
			const link = `@UUID[Compendium.stonetop.stonetop-items.Item.${item._id}]{${BEAST_CATALOG[slug].name}}`;
			if (!livestockPage.includes(link)) missing.push(`${slug} → ${link}`);
		}
		expect(missing).toEqual([]);
	});
});
