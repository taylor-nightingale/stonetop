import { describe, it, expect } from "vitest";
import { LinkMap, ourUuid } from "../../scripts/import/links.js";

const OLD = "5Sv77XzHPMBgZqJZ";
const NEW = ourUuid("stonetop-locations", "JournalEntry", "AAAAAAAAAAAAAAAA");

describe("LinkMap.relink", () => {
	it("rewrites a wrapped @UUID link by document id, keeping the label", () => {
		const map = new LinkMap();
		map.register(OLD, NEW);
		const html = `the <a>@UUID[Compendium.stonetop_pwd.stonetop-journal.JournalEntry.${OLD}]{Great Wood}</a>`;
		expect(map.relink(html)).toBe(`the <a>@UUID[${NEW}]{Great Wood}</a>`);
	});

	it("leaves unknown ids untouched", () => {
		const map = new LinkMap();
		const ref = "Compendium.stonetop_pwd.stonetop-journal.JournalEntry.UnknownId00000Z";
		expect(map.relink(`x ${ref} y`)).toBe(`x ${ref} y`);
	});

	it("ignores null/empty", () => {
		expect(new LinkMap().relink("")).toBe("");
		expect(new LinkMap().relink(null)).toBe(null);
	});
});

describe("LinkMap.relinkRef", () => {
	it("maps a bare entry/statBlock ref to the new UUID", () => {
		const map = new LinkMap();
		map.register(OLD, NEW);
		expect(map.relinkRef(`Compendium.stonetop_pwd.stonetop-bestiary.Actor.${OLD}`)).toBe(NEW);
	});

	it("returns '' for unknown or empty refs", () => {
		expect(new LinkMap().relinkRef("Compendium.x.y.Actor.ZZZZZZZZZZZZZZZZ")).toBe("");
		expect(new LinkMap().relinkRef("")).toBe("");
	});
});

describe("ourUuid", () => {
	it("builds a Compendium UUID under our system scope", () => {
		expect(ourUuid("stonetop-lore", "JournalEntry", "abc")).toBe(
			"Compendium.stonetop.stonetop-lore.JournalEntry.abc",
		);
	});
});
