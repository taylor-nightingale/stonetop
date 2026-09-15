import { describe, expect, it } from "vitest";
import { AwaitingEntry, AwaitingTranslator } from "../../scripts/i18n/awaiting.js";

const flagged = (pack, slug, key) => ({ pack, slug, entry: { key } });

const file = {
	moves: { "danus-grasp": ["description"] },
	playbooks: { "the-judge": ["backgrounds/prophet/description", "backgrounds/missionary/choices/0/text"] },
};

describe("AwaitingEntry", () => {
	it("matches only its own pack, slug and key", () => {
		const entry = new AwaitingEntry("moves", "danus-grasp", "description");
		expect(entry.matches("moves", "danus-grasp", "description")).toBe(true);
		expect(entry.matches("playbooks", "danus-grasp", "description")).toBe(false);
		expect(entry.matches("moves", "amulets-talismans", "description")).toBe(false);
		expect(entry.matches("moves", "danus-grasp", "name")).toBe(false);
	});

	it("labels itself the way the report prints it", () => {
		expect(new AwaitingEntry("moves", "danus-grasp", "description").label).toBe("moves/danus-grasp description");
	});
});

describe("AwaitingTranslator", () => {
	it("reads the authored pack → slug → keys shape", () => {
		const awaiting = AwaitingTranslator.fromJson(file);
		expect(awaiting.size).toBe(3);
		expect(awaiting.has("moves", "danus-grasp", "description")).toBe(true);
		expect(awaiting.has("playbooks", "the-judge", "backgrounds/prophet/description")).toBe(true);
	});

	it("does not acknowledge an entry that is not listed", () => {
		const awaiting = AwaitingTranslator.fromJson(file);
		expect(awaiting.has("moves", "amulets-talismans", "description")).toBe(false);
	});

	it("is empty for missing, empty and malformed files", () => {
		expect(AwaitingTranslator.empty().size).toBe(0);
		expect(AwaitingTranslator.fromJson(null).size).toBe(0);
		expect(AwaitingTranslator.fromJson({}).size).toBe(0);
		expect(AwaitingTranslator.fromJson({ moves: null }).size).toBe(0);
		expect(AwaitingTranslator.fromJson({ moves: { "danus-grasp": null } }).size).toBe(0);
	});

	it("builds itself from what the check currently flags", () => {
		const awaiting = AwaitingTranslator.fromFlagged([flagged("moves", "danus-grasp", "description")]);
		expect(awaiting.has("moves", "danus-grasp", "description")).toBe(true);
	});

	it("reports acknowledged entries that are no longer flagged", () => {
		const awaiting = AwaitingTranslator.fromJson(file);
		const stale = awaiting.staleAgainst([flagged("moves", "danus-grasp", "description")]);
		expect(stale.map(e => e.label)).toEqual([
			"playbooks/the-judge backgrounds/prophet/description",
			"playbooks/the-judge backgrounds/missionary/choices/0/text",
		]);
	});

	it("reports nothing stale while every acknowledged entry is still flagged", () => {
		const awaiting = AwaitingTranslator.fromJson({ moves: { "danus-grasp": ["description"] } });
		expect(awaiting.staleAgainst([flagged("moves", "danus-grasp", "description")])).toEqual([]);
	});

	it("narrows to one pack", () => {
		const awaiting = AwaitingTranslator.fromJson(file).forPack("moves");
		expect(awaiting.size).toBe(1);
		expect(awaiting.has("playbooks", "the-judge", "backgrounds/prophet/description")).toBe(false);
	});

	it("round-trips through the authored shape", () => {
		expect(AwaitingTranslator.fromJson(file).toJson()).toEqual(file);
	});
});

describe("AwaitingTranslator.renamed", () => {
	const awaiting = () => AwaitingTranslator.fromJson({
		moves:  { bolster: ["description"] },
		arcana: { mindgem: ["front/choices/0/text"] },
	});
	const renames = new Map([["mindgem", new Map([["front/choices/0/text", "front/choices/a-clear-gem/text"]])]]);

	it("moves an acknowledgement to the entry's new key", () => {
		expect(awaiting().renamed("arcana", renames).has("arcana", "mindgem", "front/choices/a-clear-gem/text")).toBe(true);
		expect(awaiting().renamed("arcana", renames).has("arcana", "mindgem", "front/choices/0/text")).toBe(false);
	});

	it("leaves other packs alone", () => {
		expect(awaiting().renamed("arcana", renames).has("moves", "bolster", "description")).toBe(true);
	});

	it("leaves a key the rename map does not mention", () => {
		expect(awaiting().renamed("moves", new Map()).has("moves", "bolster", "description")).toBe(true);
	});

	it("does not change how many entries are acknowledged", () => {
		expect(awaiting().renamed("arcana", renames).size).toBe(awaiting().size);
	});

	it("leaves the original untouched", () => {
		const original = awaiting();
		original.renamed("arcana", renames);
		expect(original.has("arcana", "mindgem", "front/choices/0/text")).toBe(true);
	});
});
