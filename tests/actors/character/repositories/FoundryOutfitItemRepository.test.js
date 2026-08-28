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

	// The repository is the CATALOG now: it says what gear exists, never what a sheet draws. That is
	// the inventory page's job (src/model/data/character/inventoryInsertPage.js), which names the rows
	// it lists by slug. The folder walk this used to do — "everything filed under Default is the
	// printed sheet" — is how 46 rows of the value tables became a permanent, unremovable row on
	// every character in the world, which nobody could delete because nobody had granted it.
	it("hands back every item in the pack, filed anywhere or nowhere", async () => {
		const pack = makePack(
			[
				{ ...makeEntry("cloak"), folder: "warmth" },
				{ ...makeEntry("sword-iron"), folder: "weapons-of-war" },
				{ ...makeEntry("loose"), folder: null },
			],
			[{ _id: "warmth", name: "Warmth", folder: null }],
		);
		stubGame(pack);
		const items = await new FoundryOutfitItemRepository().getAll();
		expect(items.map(i => i.slug)).toEqual(["cloak", "sword-iron", "loose"]);
	});

	it("keys the catalog by slug, which is how a page resolves the rows it names", async () => {
		stubGame(makePack([makeEntry("cloak"), makeEntry("shield")]));
		const bySlug = await new FoundryOutfitItemRepository().bySlug();
		expect([...bySlug.keys()]).toEqual(["cloak", "shield"]);
		expect(bySlug.get("shield").name).toBe("shield");
	});

	it("gives an empty catalog when the pack is missing, rather than throwing", async () => {
		stubGameNoPack();
		expect([...(await new FoundryOutfitItemRepository().bySlug()).keys()]).toEqual([]);
	});

	it("maps system.qualifier onto the item", async () => {
		stubGame(makePack([makeEntry("rope", { qualifier: "~25 ft" })]));
		const [rope] = await new FoundryOutfitItemRepository().getAll();
		expect(rope.qualifier).toBe("~25 ft");
		expect(rope.fullName).toBe("rope, ~25 ft");
	});

	it("excludes world-authored outfit items — the catalog is the compendium only", async () => {
		// A custom outfit item authored in the Items directory must NOT reach a character's inventory
		// on its own. It gets there by being dropped (embedded, removable) instead.
		const world = { _id: "w1", type: "outfitItem", name: "Homebrew charm", system: { slug: "homebrew-charm", inventoryColumn: "regular", weight: 1 }, toObject() { return this; } };
		stubGame(makePack([makeEntry("cloak")]), [world]);
		const items = await new FoundryOutfitItemRepository().getAll();
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
