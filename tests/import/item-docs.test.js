import { describe, it, expect } from "vitest";
import { BookItem } from "../../scripts/import/pdf/items.js";
import {
	normalizeName, InsertList, resolveRow, toOutfitItemDoc, toFolderDoc, sectionTitle,
	followerName, followerSlug, isGenerated, CATEGORY_ROWS, OUTFIT_PACK, FOLLOWER_PACK, splitPrintedName, fullOutfitItemName,
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

describe("splitPrintedName", () => {
	// The book sets "Rope, ~25 ft" with only the first half as the object — the rest tells you which
	// rope. The sheet bolds the first half and not the second, so the two are stored apart.
	it("splits an item from what qualifies it, at the first comma", () => {
		expect(splitPrintedName("Rope, ~25 ft")).toEqual({ name: "Rope", qualifier: "~25 ft" });
	});

	it("keeps every later comma with the qualifier", () => {
		expect(splitPrintedName("Javelins, a few, iron")).toEqual({ name: "Javelins", qualifier: "a few, iron" });
	});

	it("leaves a name the book qualifies with nothing whole", () => {
		expect(splitPrintedName("Shield")).toEqual({ name: "Shield", qualifier: "" });
	});

	it("does not mistake a slash for a comma", () => {
		expect(splitPrintedName("Sledge/litter/travois, roll-out"))
			.toEqual({ name: "Sledge/litter/travois", qualifier: "roll-out" });
	});
});

describe("fullOutfitItemName", () => {
	it("rejoins the halves into the name the book prints", () => {
		expect(fullOutfitItemName({ name: "Rope", system: { qualifier: "~25 ft" } })).toBe("Rope, ~25 ft");
	});

	it("is the bare name when nothing qualifies it", () => {
		expect(fullOutfitItemName({ name: "Shield", system: { qualifier: "" } })).toBe("Shield");
	});

	it("tolerates a document with no system at all", () => {
		expect(fullOutfitItemName({ name: "Bare" })).toBe("Bare");
	});
});

describe("InsertList", () => {
	// The two printed lists word the same object differently, and only some of those differences are
	// real: a trailing parenthetical belongs to the insert's name, never to the value table's.
	it("matches a name whose insert form carries a trailing parenthetical", () => {
		expect(new InsertList(["Sack (empty)"]).has("Sack")).toBe(true);
	});

	it("does not match an object the insert never prints", () => {
		expect(new InsertList(["Sack (empty)"]).has("Naphtha")).toBe(false);
	});

	it("reports the insert rows a set of pack names fails to cover", () => {
		const insert = new InsertList(["Sack (empty)", "Maul, iron", "Whistle"]);
		expect(insert.missingFrom(["Sack", "Whistle"])).toEqual(["Maul, iron"]);
	});
});

describe("resolveRow", () => {
	// Keyed the way build-items keys it: on the name the BOOK prints, which for a stored item is its
	// two halves rejoined (fullOutfitItemName). The pack's sack is "Sack", its "(empty)" being a note.
	const byName = new Map([[normalizeName("Sack"), { _id: "existingSackId00" }]]);
	const insert = new InsertList(["Sack (empty)", "Maul, iron"]);

	it("points a row at the item that already ships, under either list's name", () => {
		const row = resolveRow(bookItem("Sack"), section("travel gear"), byName, insert);
		expect(row.existing).toBe(true);
		expect(row.id).toBe("existingSackId00");
		expect(row.uuid).toBe(`Compendium.stonetop.${OUTFIT_PACK}.Item.existingSackId00`);
	});

	it("mints a deterministic id for an insert row the pack doesn't have", () => {
		const a = resolveRow(bookItem("Maul, iron"), section("common weapons"), byName, insert);
		const b = resolveRow(bookItem("Maul, iron"), section("common weapons"), byName, insert);
		expect(a.existing).toBe(false);
		expect(a.id).toMatch(/^[A-Za-z0-9]{16}$/);
		expect(a.id).toBe(b.id);
	});

	// Everything the value tables price SHIPS — the reference page links it and a GM drags it onto a
	// sheet. What the insert decides is where it is FILED: only its own rows belong in the pack's
	// "Default" folder, which a character sheet draws in full. Getting that backwards once put 46 rows
	// of special gear on every character in the world.
	it("marks a row the insert prints as belonging in Default", () => {
		expect(resolveRow(bookItem("Maul, iron"), section("common weapons"), byName, insert).onInsert).toBe(true);
		expect(resolveRow(bookItem("Sack"), section("travel gear"), byName, insert).onInsert).toBe(true);
	});

	it("still makes an item for a row the insert doesn't print, filed outside Default", () => {
		const row = resolveRow(bookItem("Sword, iron"), section("weapons of war"), byName, insert);
		expect(row.kind).toBe("outfitItem");
		expect(row.onInsert).toBe(false);
		expect(row.uuid).toBe(`Compendium.stonetop.${OUTFIT_PACK}.Item.${row.id}`);
	});

	it("makes a livestock row a follower, not gear", () => {
		const row = resolveRow(bookItem("Mule, follower?"), section("livestock & other beasts"), byName, insert);
		expect(row.kind).toBe("follower");
		expect(row.pack).toBe(FOLLOWER_PACK);
	});

	it("leaves a bronze-weapons cross-reference row with nothing to link", () => {
		const row = resolveRow(bookItem("Weapons of war"), section("bronze weapons*"), byName, insert);
		expect(row.kind).toBe("category");
		expect(row.uuid).toBeNull();
	});

	// The category rule is scoped to the bronze section, where the book prices whole CATEGORIES; the
	// same words elsewhere name a row like any other, and must not be swallowed by it.
	it("treats a real row sharing a category row's name as a row, not a category", () => {
		expect(CATEGORY_ROWS.has("Weapons of war")).toBe(true);
		const row = resolveRow(bookItem("Weapons of war"), section("weapons of war"), byName, insert);
		expect(row.kind).not.toBe("category");
	});

	// An item the pack already holds keeps its id whatever the insert calls it — the row contributes
	// only that id, so hand-authored weights, columns and slugs are never rewritten.
	it("points at an item that ships without minting a second one", () => {
		const row = resolveRow(bookItem("Sack"), section("travel gear"), byName, new InsertList([]));
		expect(row.kind).toBe("outfitItem");
		expect(row.existing).toBe(true);
		expect(row.id).toBe("existingSackId00");
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
