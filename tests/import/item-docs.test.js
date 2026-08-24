import { describe, it, expect } from "vitest";
import { BookItem } from "../../scripts/import/pdf/items.js";
import {
	normalizeName, resolveRow, toOutfitItemDoc, toFolderDoc, sectionTitle,
	followerName, followerSlug, isGenerated, CATEGORY_ROWS, OUTFIT_PACK, FOLLOWER_PACK,
} from "../../scripts/import/item-docs.js";

const bookItem = (name, patch = {}) => Object.assign(new BookItem("common", "weapons"), { name }, patch);
const section = (title) => ({ title });

describe("normalizeName", () => {
	// The Inventory insert (p. 142) and the Common items table (pp. 94-95) name several of the same
	// objects differently; this is what lets a row find the item that already ships.
	it("sees through the two lists' punctuation and and/or", () => {
		expect(normalizeName("Mattock, iron and/or wood")).toBe("mattock iron or wood");
		expect(normalizeName("Rope, ~25 feet")).toBe(normalizeName("Rope, ~25 ft"));
	});
});

describe("resolveRow", () => {
	const byName = new Map([[normalizeName("Sack (empty)"), { _id: "existingSackId00" }]]);

	it("points a row at the item that already ships, under either list's name", () => {
		const row = resolveRow(bookItem("Sack"), section("travel gear"), byName);
		expect(row.existing).toBe(true);
		expect(row.id).toBe("existingSackId00");
		expect(row.uuid).toBe(`Compendium.stonetop.${OUTFIT_PACK}.Item.existingSackId00`);
	});

	it("mints a deterministic id for a row the pack doesn't have", () => {
		const a = resolveRow(bookItem("Sword, iron"), section("weapons of war"), byName);
		const b = resolveRow(bookItem("Sword, iron"), section("weapons of war"), byName);
		expect(a.existing).toBe(false);
		expect(a.id).toMatch(/^[A-Za-z0-9]{16}$/);
		expect(a.id).toBe(b.id);
	});

	it("makes a livestock row a follower, not gear", () => {
		const row = resolveRow(bookItem("Mule, follower?"), section("livestock & other beasts"), byName);
		expect(row.kind).toBe("follower");
		expect(row.pack).toBe(FOLLOWER_PACK);
	});

	it("leaves a bronze-weapons cross-reference row with nothing to link", () => {
		const row = resolveRow(bookItem("Weapons of war"), section("bronze weapons*"), byName);
		expect(row.kind).toBe("category");
		expect(row.uuid).toBeNull();
	});

	it("still makes an item for a real row that happens to share a category row's name", () => {
		expect(CATEGORY_ROWS.has("Weapons of war")).toBe(true);
		const row = resolveRow(bookItem("Weapons of war"), section("weapons of war"), byName);
		expect(row.kind).toBe("outfitItem");
	});
});

describe("toOutfitItemDoc", () => {
	it("carries the book's Value, tags, note and load onto the document", () => {
		const doc = toOutfitItemDoc(bookItem("Maul, iron", {
			value: 0, weight: 2, tagList: ["close", "forceful"], note: "x piercing",
		}), { folder: "folder0000000000" });
		expect(doc.type).toBe("outfitItem");
		expect(doc.system.slug).toBe("maul-iron");
		expect(doc.system.weight).toBe(2);
		expect(doc.system.inventoryColumn).toBe("regular");
		expect(doc.system.value).toBe(0);
		expect(doc.system.tagList).toEqual(["close", "forceful"]);
		expect(doc.folder).toBe("folder0000000000");
	});

	// A pocket item costs no ◇, but the pack stores every small item as weight 1 in the small column
	// — the shape every hand-authored one already uses.
	it("files a diamond-less row as a weight-1 small item", () => {
		const doc = toOutfitItemDoc(bookItem("Gloves", { weight: 0 }));
		expect(doc.system.weight).toBe(1);
		expect(doc.system.inventoryColumn).toBe("small");
	});

	it("stamps what it generates, so a rebuild can tell it from hand-authored gear", () => {
		expect(isGenerated(toOutfitItemDoc(bookItem("Gloves")))).toBe(true);
		expect(isGenerated({ flags: {} })).toBe(false);
	});
});

describe("toFolderDoc", () => {
	it("nests under its parent and gets a stable id", () => {
		const parent = toFolderDoc("Special items", { pack: OUTFIT_PACK });
		const child = toFolderDoc("Armor", { pack: OUTFIT_PACK, parent: parent._id });
		expect(child.folder).toBe(parent._id);
		expect(child._key).toBe(`!folders!${child._id}`);
		expect(isGenerated(child)).toBe(true);
	});

	// "Armor" is a folder at both levels — the Inventory insert's and the special-items one — and the
	// packer keys folders by their directory path, so that path is what has to make the id unique.
	it("keeps two same-named folders apart by their path", () => {
		const top = toFolderDoc("Armor", { pack: OUTFIT_PACK, key: "armor" });
		const nested = toFolderDoc("Armor", { pack: OUTFIT_PACK, parent: "parent0000000000", key: "special/armor" });
		expect(top._id).not.toBe(nested._id);
	});

	it("gives the same path the same id on every run", () => {
		const once = toFolderDoc("Armor", { pack: OUTFIT_PACK, key: "special/armor" });
		const again = toFolderDoc("Armor", { pack: OUTFIT_PACK, key: "special/armor" });
		expect(once._id).toBe(again._id);
	});
});

describe("followerName / followerSlug", () => {
	// The book's ", follower?" says which pack the row belongs in, not what the animal is called.
	it("drops the book's follower annotation", () => {
		expect(followerName("Mule, follower?")).toBe("Mule");
		expect(followerName("Dog, follower")).toBe("Dog");
		expect(followerSlug("Horse, follower?")).toBe("horse");
	});

	it("leaves a name that merely contains the word alone", () => {
		expect(followerName("Follower's pack")).toBe("Follower's pack");
	});
});

describe("sectionTitle", () => {
	it("title-cases a heading the book sets lower case, and drops its footnote marker", () => {
		expect(sectionTitle("weapons of war")).toBe("Weapons of War");
		expect(sectionTitle("bronze weapons*")).toBe("Bronze Weapons");
		expect(sectionTitle("fire & light sources")).toBe("Fire & Light Sources");
	});
});
