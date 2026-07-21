import { describe, it, expect } from "vitest";
import { OutfitItem } from "../../../../src/model/data/character/OutfitItem.js";

// OutfitItem.fromDocument is the single document → entity mapping, shared by the outfit repository
// (pack + world items) and the outfit-item sheet's own preview.

const SHIELD_DOC = {
	name: "Shield",
	system: {
		slug: "shield", inventoryColumn: "regular", weight: 2, tagList: "",
		note: "+1 armor", resource: null, twoCol: false, armor: { modifier: 1 },
	},
};

describe("OutfitItem.fromDocument", () => {
	it("maps every authored field off the document", () => {
		const oi = OutfitItem.fromDocument(SHIELD_DOC);
		expect(oi.slug).toBe("shield");
		expect(oi.name).toBe("Shield");           // the document name, not a system field
		expect(oi.weight).toBe(2);
		expect(oi.tags).toBe("");                 // system.tagList, not system.tags (Foundry reserves that)
		expect(oi.note).toBe("+1 armor");
		expect(oi.inventoryColumn).toBe("regular");
		expect(oi.armor).toEqual({ modifier: 1 });
	});

	it("carries the folder-derived group when one is given", () => {
		expect(OutfitItem.fromDocument(SHIELD_DOC, "Armor").group).toBe("Armor");
	});

	it("defaults the group to null — world items have no section", () => {
		expect(OutfitItem.fromDocument(SHIELD_DOC).group).toBeNull();
	});

	it("fills defaults for a document with an empty system", () => {
		const oi = OutfitItem.fromDocument({ name: "Odd thing", system: {} });
		expect(oi.weight).toBe(0);
		expect(oi.tags).toBe("");
		expect(oi.note).toBeNull();
		expect(oi.inventoryColumn).toBeNull();
		expect(oi.resource).toBeNull();
		expect(oi.twoCol).toBe(false);
		expect(oi.armor).toBeNull();
	});

	it("tolerates a document with no system at all", () => {
		expect(OutfitItem.fromDocument({ name: "Bare" }).name).toBe("Bare");
	});
});
