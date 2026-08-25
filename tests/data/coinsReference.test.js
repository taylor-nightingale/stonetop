import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import { Reference } from "../../src/model/data/Reference.js";
import { Advice } from "../../src/model/data/Advice.js";
import { AdviceParagraph, AdviceList } from "../../src/model/data/Advice.js";

// The steading's coinage panel labels three fields Purses / Handfuls / Coins. Its ? explains how to
// GET coin; the Coins sidebar (Book I p. 93) is what says how those three relate. It is written into
// the language file by scripts/import/build-book-one.js — which also builds the page it links on to,
// so this checks both that the sheet can find the prose and that the link still lands somewhere.

let en, reference;

beforeAll(async () => {
	en = JSON.parse(await fs.readFile("languages/en.json", "utf8"));
	reference = Reference.fromTranslations(en.stonetop.reference);
});

describe("the coins reference sidebar", () => {
	it("is keyed to the same topic as the coinage panel's ? button", () => {
		// steading.hbs passes advice="coin"; the sidebar must answer to that exact key.
		expect(Advice.fromTranslations(en.stonetop.advice).lookup("coin")).not.toBeNull();
		expect(reference.lookup("coin")).not.toBeNull();
	});

	it("is titled for what it is, not for the advice beside it", () => {
		expect(reference.lookup("coin").title).toBe("Coins");
	});

	it("explains what a handful and a purse actually are", () => {
		const text = reference.lookup("coin").blocks
			.flatMap(b => (b instanceof AdviceList ? b.items : [b.text])).join(" ");
		expect(text).toMatch(/handful of coins contains about 10/i);
		expect(text).toMatch(/purse of coins contains about 10 handfuls/i);
		expect(text).toMatch(/one silver coin is roughly worth/i);
	});

	it("carries both prose and a bulleted list, as the book sets it", () => {
		const blocks = reference.lookup("coin").blocks;
		expect(blocks.some(b => b instanceof AdviceParagraph)).toBe(true);
		expect(blocks.some(b => b instanceof AdviceList)).toBe(true);
	});

	// Generated where the page's ids are known, so nothing in src/ hard-codes them.
	it("links on to the full reference page", () => {
		const text = reference.lookup("coin").blocks.filter(b => b instanceof AdviceParagraph).map(b => b.text).join(" ");
		expect(text).toMatch(/@UUID\[Compendium\.stonetop\.reference\.JournalEntry\.\w+\.JournalEntryPage\.\w+\]/);
	});

	it("names a page the reference pack actually ships", async () => {
		const text = reference.lookup("coin").blocks.filter(b => b instanceof AdviceParagraph).map(b => b.text).join(" ");
		const [, entryId, pageId] = text.match(/JournalEntry\.(\w+)\.JournalEntryPage\.(\w+)/);
		const entry = JSON.parse(await fs.readFile("packs/src/reference/gear-and-possessions.json", "utf8"));
		expect(entryId).toBe(entry._id);
		expect(pageId).toBe(entry.pages[0]._id);
	});
});
