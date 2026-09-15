import { describe, it, expect } from "vitest";
import { OutfitItem } from "../../../../src/model/data/character/OutfitItem.js";

// OutfitItem.fromDocument is the single document → entity mapping, shared by the outfit repository
// (pack + world items) and the outfit-item sheet's own preview.

const SHIELD_DOC = {
	name: "Shield",
	system: {
		slug: "shield", inventoryColumn: "regular", weight: 2, tagList: { selected: [], options: [], multi: true, allowCustom: true },
		note: "+1 armor", resource: null, armor: { modifier: 1 },
	},
};

describe("OutfitItem.fromDocument", () => {
	it("maps every authored field off the document", () => {
		const oi = OutfitItem.fromDocument(SHIELD_DOC);
		expect(oi.slug).toBe("shield");
		expect(oi.name).toBe("Shield");           // the document name, not a system field
		expect(oi.weight).toBe(2);
		expect(oi.tags.values).toEqual([]);       // system.tagList, not system.tags (Foundry reserves that)
		expect(oi.note).toBe("+1 armor");
		expect(oi.inventoryColumn).toBe("regular");
		expect(oi.armor).toEqual({ modifier: 1 });
	});

	// Where a row sits and how it is set are the page's business (InventoryPage), so nothing about
	// where the document is FILED comes along — the entity is the gear, and only the gear.
	it("reads the qualifier the printed name trails", () => {
		const doc = { name: "Rope", system: { slug: "rope", qualifier: "~25 ft" } };
		expect(OutfitItem.fromDocument(doc).qualifier).toBe("~25 ft");
	});

	it("rejoins the halves into the name the book prints", () => {
		const doc = { name: "Rope", system: { slug: "rope", qualifier: "~25 ft" } };
		expect(OutfitItem.fromDocument(doc).fullName).toBe("Rope, ~25 ft");
	});

	it("is its own full name when the book qualifies it with nothing", () => {
		expect(OutfitItem.fromDocument(SHIELD_DOC).fullName).toBe("Shield");
	});

	it("fills defaults for a document with an empty system", () => {
		const oi = OutfitItem.fromDocument({ name: "Odd thing", system: {} });
		expect(oi.weight).toBe(0);
		expect(oi.tags.isEmpty).toBe(true);
		expect(oi.note).toBeNull();
		expect(oi.inventoryColumn).toBeNull();
		expect(oi.resource).toBeNull();
		expect(oi.qualifier).toBe("");
		expect(oi.armor).toBeNull();
	});

	it("tolerates a document with no system at all", () => {
		expect(OutfitItem.fromDocument({ name: "Bare" }).name).toBe("Bare");
	});
});

// A move that changes gear (Armored) asks the entity for a changed copy — it never pokes a field
// onto the one the catalog holds, which every other character on the sheet is reading from.
describe("OutfitItem — with-methods", () => {
	it("gives back the same gear at a different load", () => {
		const lighter = OutfitItem.fromDocument(SHIELD_DOC).withWeight(1);
		expect(lighter.weight).toBe(1);
		expect(lighter.slug).toBe("shield");
		expect(lighter.name).toBe("Shield");
		expect(lighter.armor).toEqual({ modifier: 1 });
	});

	it("leaves the original untouched", () => {
		const shield = OutfitItem.fromDocument(SHIELD_DOC);
		shield.withWeight(1);
		expect(shield.weight).toBe(2);
	});

	it("drops one tag and keeps the rest", () => {
		const armor = OutfitItem.fromDocument({
			name: "Hauberk", system: { slug: "hauberk", weight: 2, tagList: ["warm", "cumbersome"] },
		});
		expect(armor.withoutTag("cumbersome").tags.values).toEqual(["warm"]);
		expect(armor.tags.values).toEqual(["warm", "cumbersome"]);
	});

	it("is unchanged by dropping a tag it never carried", () => {
		const shield = OutfitItem.fromDocument(SHIELD_DOC);
		expect(shield.withoutTag("cumbersome").tags.values).toEqual([]);
	});

	// Nothing normalizes an entity built by hand, so the stored token list reaches `withoutTag` raw.
	it("drops a tag off a raw stored token list", () => {
		const armor = OutfitItem.fromDocument({ name: "Hauberk", system: { slug: "h", tagList: "warm, cumbersome" } });
		expect(armor.withoutTag("cumbersome").tags.values).toEqual(["warm"]);
	});
});
