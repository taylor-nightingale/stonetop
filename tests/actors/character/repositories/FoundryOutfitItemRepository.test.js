import { describe, it, expect, vi, afterEach } from "vitest";
import { FoundryOutfitItemRepository } from "../../../../src/actors/character/repositories/FoundryOutfitItemRepository.js";

// -- Helpers ------------------------------------------------------------------

function makeEntry(slug, systemOverrides = {}) {
	return {
		_id: `id-${slug}`,
		name: slug,
		system: { slug, inventoryColumn: "regular", weight: 1, tagList: "", note: null, ...systemOverrides },
	};
}

function makePack(entries = [], folders = []) {
	return {
		getIndex: vi.fn(async () => {}),
		index: entries,
		folders,
	};
}

function stubGame(pack, worldItems = []) {
	vi.stubGlobal("game", {
		packs: { get: () => pack },
		items: { contents: worldItems, get: id => worldItems.find(i => i._id === id) ?? null },
	});
}

function stubGameNoPack() {
	vi.stubGlobal("game", { packs: { get: () => null } });
}

// -- Tests --------------------------------------------------------------------

describe("FoundryOutfitItemRepository", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("returns [] when the pack is missing", async () => {
		stubGameNoPack();
		const repo = new FoundryOutfitItemRepository();
		expect(await repo.getAll()).toEqual([]);
	});

	it("defaults item.armor to null when system.armor is absent", async () => {
		stubGame(makePack([makeEntry("cloak")]));
		const repo = new FoundryOutfitItemRepository();
		const items = await repo.getAll();
		expect(items[0].armor).toBeNull();
	});

	it("maps system.armor to item.armor for a base value", async () => {
		stubGame(makePack([makeEntry("thick-hides", { armor: { base: 1 } })]));
		const repo = new FoundryOutfitItemRepository();
		const items = await repo.getAll();
		expect(items[0].armor).toEqual({ base: 1 });
	});

	it("maps system.armor to item.armor for a modifier value", async () => {
		stubGame(makePack([makeEntry("shield", { armor: { modifier: 1 } })]));
		const repo = new FoundryOutfitItemRepository();
		const items = await repo.getAll();
		expect(items[0].armor).toEqual({ modifier: 1 });
	});

	it("maps system.tagList to item.tags", async () => {
		stubGame(makePack([makeEntry("knife", { tagList: { selected: ["hand", "thrown"], options: [], multi: true, allowCustom: true } })]));
		const repo = new FoundryOutfitItemRepository();
		const items = await repo.getAll();
		expect(items[0].tags.values).toEqual(["hand", "thrown"]);
	});

	it("leaves item.tags empty when the reserved system.tags is used instead of tagList", async () => {
		stubGame(makePack([makeEntry("knife", { tags: "hand, thrown", tagList: null })]));
		const repo = new FoundryOutfitItemRepository();
		const items = await repo.getAll();
		expect(items[0].tags.isEmpty).toBe(true);
	});

	it("maps system.note to item.note", async () => {
		stubGame(makePack([makeEntry("arrows", { note: "x piercing" })]));
		const repo = new FoundryOutfitItemRepository();
		const items = await repo.getAll();
		expect(items[0].note).toBe("x piercing");
	});

	it("resolves folder id to group name", async () => {
		const entry = { ...makeEntry("knife"), folder: "folder-1" };
		const pack = makePack([entry], [{ _id: "folder-1", name: "Weapons" }]);
		stubGame(pack);
		const repo = new FoundryOutfitItemRepository();
		const items = await repo.getAll();
		expect(items[0].group).toBe("Weapons");
	});

	it("sets group to null when item has no folder", async () => {
		stubGame(makePack([makeEntry("cloak")]));
		const repo = new FoundryOutfitItemRepository();
		const items = await repo.getAll();
		expect(items[0].group).toBeNull();
	});

	it("excludes world-authored outfit items — the catalog is the compendium only", async () => {
		// A custom outfit item authored in the Items directory must NOT force-show on every character's
		// inventory grid. It reaches a character only by being dropped (embedded, removable) instead.
		const world = { _id: "w1", type: "outfitItem", name: "Homebrew charm", system: { slug: "homebrew-charm", inventoryColumn: "regular", weight: 1 }, toObject() { return this; } };
		stubGame(makePack([makeEntry("cloak")]), [world]);
		const repo = new FoundryOutfitItemRepository();
		const items = await repo.getAll();
		expect(items.map(i => i.slug)).toEqual(["cloak"]);
	});

	it("caches results — getIndex is not called a second time", async () => {
		const pack = makePack([makeEntry("cloak")]);
		stubGame(pack);
		const repo = new FoundryOutfitItemRepository();
		await repo.getAll();
		await repo.getAll();
		expect(pack.getIndex).toHaveBeenCalledTimes(1);
	});
});
