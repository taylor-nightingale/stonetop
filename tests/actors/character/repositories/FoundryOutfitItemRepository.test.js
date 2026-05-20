import { describe, it, expect, vi, afterEach } from "vitest";
import { FoundryOutfitItemRepository } from "../../../../module/actors/character/repositories/FoundryOutfitItemRepository.js";

// -- Helpers ------------------------------------------------------------------

function makeEntry(slug, flags = {}) {
	return {
		_id: `id-${slug}`,
		name: slug,
		flags: { stonetop: { slug, inventoryColumn: "regular", sortOrder: 1, weight: 1, ...flags } },
	};
}

function makePack(entries = []) {
	return {
		getIndex: vi.fn(async () => {}),
		index: entries,
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

	it("defaults item.armor to null when flag is absent", async () => {
		stubGame(makePack([makeEntry("cloak")]));
		const repo = new FoundryOutfitItemRepository();
		const items = await repo.getAll();
		expect(items[0].armor).toBeNull();
	});

	it("maps flags.stonetop.armor to item.armor for a base value", async () => {
		stubGame(makePack([makeEntry("thick-hides", { armor: { base: 1 } })]));
		const repo = new FoundryOutfitItemRepository();
		const items = await repo.getAll();
		expect(items[0].armor).toEqual({ base: 1 });
	});

	it("maps flags.stonetop.armor to item.armor for a modifier value", async () => {
		stubGame(makePack([makeEntry("shield", { armor: { modifier: 1 } })]));
		const repo = new FoundryOutfitItemRepository();
		const items = await repo.getAll();
		expect(items[0].armor).toEqual({ modifier: 1 });
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
