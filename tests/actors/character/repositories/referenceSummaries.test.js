import { describe, it, expect, vi, afterEach } from "vitest";
import { summarizeEntries } from "../../../../src/actors/character/repositories/referenceSummaries.js";
import { FoundryFollowerRepository } from "../../../../src/actors/character/repositories/FoundryFollowerRepository.js";
import { FoundryInsertRepository } from "../../../../src/actors/character/repositories/FoundryInsertRepository.js";
import { FoundryPossessionRepository } from "../../../../src/actors/character/repositories/FoundryPossessionRepository.js";

function entry(slug, name) {
	return { _id: `id-${slug}`, name, system: { slug } };
}

function makePack(entries = []) {
	return { getIndex: vi.fn(async () => {}), index: entries, folders: [] };
}

function stubGame(pack, worldItems = []) {
	vi.stubGlobal("game", {
		packs: { get: () => pack },
		items: { contents: worldItems, get: id => worldItems.find(i => i._id === id) ?? null },
	});
}

// World items are documents with .toObject(); mimic that.
function worldItem(type, slug, name) {
	const obj = { _id: `w-${slug}`, type, name, system: { slug } };
	return { ...obj, type, toObject: () => obj };
}

afterEach(() => vi.unstubAllGlobals());

describe("summarizeEntries", () => {
	it("maps to { slug, name }, drops slug-less entries, sorts by name", () => {
		expect(summarizeEntries([
			entry("b", "Beta"),
			{ _id: "x", name: "No slug", system: {} },
			entry("a", "Alpha"),
		])).toEqual([{ slug: "a", name: "Alpha" }, { slug: "b", name: "Beta" }]);
	});

	it("deduplicates by slug — first entry wins", () => {
		expect(summarizeEntries([entry("a", "Pack Alpha"), entry("a", "World Alpha")]))
			.toEqual([{ slug: "a", name: "Pack Alpha" }]);
	});

	it("falls back to the slug when an entry has no name", () => {
		expect(summarizeEntries([{ _id: "x", system: { slug: "nameless" } }]))
			.toEqual([{ slug: "nameless", name: "nameless" }]);
	});

	it("returns [] for nullish input", () => {
		expect(summarizeEntries(undefined)).toEqual([]);
	});
});

describe("reference repositories — listSummaries (pack + world)", () => {
	it("FoundryFollowerRepository merges compendium and world followers", async () => {
		stubGame(makePack([entry("crew", "Crew")]), [worldItem("follower", "homebrew", "Homebrew Ally")]);
		expect(await new FoundryFollowerRepository().listSummaries()).toEqual([
			{ slug: "crew", name: "Crew" },
			{ slug: "homebrew", name: "Homebrew Ally" },
		]);
	});

	it("FoundryInsertRepository merges compendium and world inserts", async () => {
		stubGame(makePack([entry("invocations", "Invocations")]), [worldItem("insert", "custom", "Custom Insert")]);
		expect(await new FoundryInsertRepository().listSummaries()).toEqual([
			{ slug: "custom", name: "Custom Insert" },
			{ slug: "invocations", name: "Invocations" },
		]);
	});

	it("FoundryPossessionRepository merges compendium and world possessions", async () => {
		stubGame(makePack([entry("sacred-pouch", "Sacred Pouch")]), [worldItem("possession", "relic", "Old Relic")]);
		expect(await new FoundryPossessionRepository().listSummaries()).toEqual([
			{ slug: "relic", name: "Old Relic" },
			{ slug: "sacred-pouch", name: "Sacred Pouch" },
		]);
	});

	it("returns [] when the pack is missing and no world items exist", async () => {
		vi.stubGlobal("game", { packs: { get: () => null }, items: { contents: [] } });
		expect(await new FoundryInsertRepository().listSummaries()).toEqual([]);
	});
});
