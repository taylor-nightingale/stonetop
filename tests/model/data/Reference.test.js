import { describe, it, expect } from "vitest";
import { Reference, ReferenceSidebar } from "../../../src/model/data/Reference.js";
import { AdviceParagraph, AdviceList } from "../../../src/model/data/Advice.js";

// A reference sidebar is the "what IS this" half of a ? button — Book I's Coins sidebar beside the
// "If you want to… get some coin" advice. It stores the same blocks advice does, so the same
// renderer draws both; these check that shape survives the round trip.

const TREE = {
	coins: {
		title: "Coins",
		blocks: [
			{ type: "para", text: "_Stonetop_ abstracts coinage into individual coins, handfuls, and ◇ purses." },
			{ type: "list", items: ["A handful of coins contains about 10 individual coins."] },
		],
	},
};

describe("ReferenceSidebar", () => {
	it("reads a title and its blocks out of the stored shape", () => {
		const sidebar = ReferenceSidebar.fromStored("coins", TREE.coins);
		expect(sidebar.key).toBe("coins");
		expect(sidebar.title).toBe("Coins");
		expect(sidebar.blocks[0]).toBeInstanceOf(AdviceParagraph);
		expect(sidebar.blocks[1]).toBeInstanceOf(AdviceList);
	});

	it("drops a block of a type nothing renders, rather than failing", () => {
		const sidebar = ReferenceSidebar.fromStored("coins", { title: "Coins", blocks: [{ type: "diagram" }] });
		expect(sidebar.blocks).toEqual([]);
	});

	it("survives a malformed entry", () => {
		const sidebar = ReferenceSidebar.fromStored("coins", undefined);
		expect(sidebar.title).toBe("");
		expect(sidebar.blocks).toEqual([]);
	});
});

describe("Reference", () => {
	it("looks a sidebar up by the same key as the advice it accompanies", () => {
		expect(Reference.fromTranslations(TREE).lookup("coins").title).toBe("Coins");
	});

	// Most topics have advice and no sidebar; that is the normal case, not an error.
	it("returns null for a topic the book prints no sidebar for", () => {
		expect(Reference.fromTranslations(TREE).lookup("fortunes")).toBeNull();
	});

	it("starts empty, so a dialog opened before i18nInit shows advice alone", () => {
		expect(new Reference().lookup("coins")).toBeNull();
		expect(Reference.current.lookup("anything")).toBeNull();
	});
});
