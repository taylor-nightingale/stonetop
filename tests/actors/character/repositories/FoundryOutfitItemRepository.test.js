import { describe, it, expect, vi, afterEach } from "vitest";
import { FoundryOutfitItemRepository } from "../../../../src/actors/character/repositories/FoundryOutfitItemRepository.js";

// -- Helpers ------------------------------------------------------------------

function makeEntry(slug, systemOverrides = {}) {
	return {
		_id: `id-${slug}`,
		name: slug,
		system: { slug, inventoryColumn: "regular", sortOrder: 1, weight: 1, tags: "", note: null, ...systemOverrides },
	};
}

function makePack(entries = [], folders = []) {
	return {
		getIndex: vi.fn(async () => {}),
		index: entries,
		folders,
	};
}

function stubGame(pack) {
	vi.stubGlobal("game", { packs: { get: () => pack } });
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

	it("maps system.tags to item.tags", async () => {
		stubGame(makePack([makeEntry("knife", { tags: "hand, thrown" })]));
		const repo = new FoundryOutfitItemRepository();
		const items = await repo.getAll();
		expect(items[0].tags).toBe("hand, thrown");
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

	it("caches results — getIndex is not called a second time", async () => {
		const pack = makePack([makeEntry("cloak")]);
		stubGame(pack);
		const repo = new FoundryOutfitItemRepository();
		await repo.getAll();
		await repo.getAll();
		expect(pack.getIndex).toHaveBeenCalledTimes(1);
	});
});
