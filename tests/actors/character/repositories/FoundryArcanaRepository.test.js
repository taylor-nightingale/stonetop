import { describe, it, expect, vi, afterEach } from "vitest";
import { FoundryArcanaRepository } from "../../../../module/actors/character/repositories/FoundryArcanaRepository.js";
import { MinorArcanum } from "../../../../module/model/MinorArcanum.js";

// -- Fixtures -----------------------------------------------------------------

const ARCANUM_FLAGS = {
	slug: "huge-wooden-sphere",
	front: { title: "A Huge Wooden Sphere", item: null, description: "", unlock: { description: "", requirements: [] } },
	back:  { title: "Ffyrnig Tonic", item: null, description: "", resource: null, move: null, options: [] },
};

const OTHER_FLAGS = {
	slug: "humble-broom",
	front: { title: "A Humble Broom", item: null, description: "", unlock: { description: "", requirements: [] } },
	back:  { title: "Broom of Sweeping", item: null, description: "", resource: null, move: null, options: [] },
};

// -- Helpers ------------------------------------------------------------------

function makePack(entries = [], flagsBySlug = {}) {
	return {
		getIndex: vi.fn(async () => {}),
		index: entries,
		getDocument: vi.fn(async (id) => {
			const entry = entries.find(e => e._id === id);
			const slug  = entry?.flags?.stonetop?.slug;
			return { flags: { stonetop: flagsBySlug[slug] } };
		}),
	};
}

function stubGame(pack) {
	vi.stubGlobal("game", { packs: { get: () => pack } });
}

function stubGameNoPack() {
	vi.stubGlobal("game", { packs: { get: () => null } });
}

// A world `move`/arcanum item carrying the slug flag — the custom-arcanum case.
function worldArcanum(flags) {
	return { type: "move", system: { moveType: "arcanum" }, flags: { stonetop: flags } };
}

function stubGameWithItems(pack, items) {
	vi.stubGlobal("game", { packs: { get: () => pack }, items: { find: (fn) => items.find(fn) ?? null } });
}

// -- Tests --------------------------------------------------------------------

describe("FoundryArcanaRepository", () => {
	afterEach(() => vi.unstubAllGlobals());

	describe("findBySlug", () => {
		it("returns null when pack is not registered", async () => {
			stubGameNoPack();
			const repo = new FoundryArcanaRepository();
			expect(await repo.findBySlug("huge-wooden-sphere")).toBeNull();
		});

		it("returns null when slug is not in index", async () => {
			stubGame(makePack([], {}));
			const repo = new FoundryArcanaRepository();
			expect(await repo.findBySlug("huge-wooden-sphere")).toBeNull();
		});

		it("returns a MinorArcanum when slug is found", async () => {
			const pack = makePack(
				[{ _id: "abc123xyz0000001", flags: { stonetop: { slug: "huge-wooden-sphere" } } }],
				{ "huge-wooden-sphere": ARCANUM_FLAGS },
			);
			stubGame(pack);
			const repo = new FoundryArcanaRepository();
			const result = await repo.findBySlug("huge-wooden-sphere");
			expect(result).toBeInstanceOf(MinorArcanum);
			expect(result.slug).toBe("huge-wooden-sphere");
			expect(result.front.title).toBe("A Huge Wooden Sphere");
			expect(result.back.title).toBe("Ffyrnig Tonic");
		});

		it("calls getIndex with flags.stonetop.slug field", async () => {
			const pack = makePack([], {});
			stubGame(pack);
			const repo = new FoundryArcanaRepository();
			await repo.findBySlug("anything");
			expect(pack.getIndex).toHaveBeenCalledWith({ fields: ["flags.stonetop.slug"] });
		});

		it("falls back to a world move/arcanum item when the slug is not in the pack", async () => {
			const custom = { ...ARCANUM_FLAGS, slug: "custom-arcanum-abc123" };
			stubGameWithItems(makePack([], {}), [worldArcanum(custom)]);
			const repo = new FoundryArcanaRepository();
			const result = await repo.findBySlug("custom-arcanum-abc123");
			expect(result).toBeInstanceOf(MinorArcanum);
			expect(result.slug).toBe("custom-arcanum-abc123");
			expect(result.front.title).toBe("A Huge Wooden Sphere");
		});

		it("does NOT cache a world arcanum — re-reads so edits show on the next render", async () => {
			// Deep-clone so mutating the item below doesn't pollute the shared ARCANUM_FLAGS fixture.
			const item = worldArcanum({ ...structuredClone(ARCANUM_FLAGS), slug: "custom-arcanum-xyz" });
			stubGameWithItems(makePack([], {}), [item]);
			const repo = new FoundryArcanaRepository();
			const first = await repo.findBySlug("custom-arcanum-xyz");
			expect(first.front.title).toBe("A Huge Wooden Sphere");
			// Simulate the user editing the custom arcanum's flags...
			item.flags.stonetop.front.title = "Renamed Arcanum";
			const second = await repo.findBySlug("custom-arcanum-xyz");
			expect(second.front.title).toBe("Renamed Arcanum");
		});

		it("ignores world items that are not a move/arcanum or whose slug differs", async () => {
			stubGameWithItems(makePack([], {}), [
				{ type: "move", system: { moveType: "basic" }, flags: { stonetop: { slug: "custom-arcanum-1" } } },
				worldArcanum({ ...ARCANUM_FLAGS, slug: "custom-arcanum-other" }),
			]);
			const repo = new FoundryArcanaRepository();
			expect(await repo.findBySlug("custom-arcanum-1")).toBeNull();
			expect(await repo.findBySlug("custom-arcanum-missing")).toBeNull();
		});

		it("prefers a shipped pack arcanum over a world item with the same slug", async () => {
			const pack = makePack(
				[{ _id: "abc123xyz0000001", flags: { stonetop: { slug: "huge-wooden-sphere" } } }],
				{ "huge-wooden-sphere": ARCANUM_FLAGS },
			);
			const worldDupe = worldArcanum({ ...OTHER_FLAGS, slug: "huge-wooden-sphere" });
			stubGameWithItems(pack, [worldDupe]);
			const repo = new FoundryArcanaRepository();
			const result = await repo.findBySlug("huge-wooden-sphere");
			expect(result.front.title).toBe("A Huge Wooden Sphere"); // pack wins
		});

		it("caches the result — getDocument is not called a second time", async () => {
			const pack = makePack(
				[{ _id: "abc123xyz0000001", flags: { stonetop: { slug: "huge-wooden-sphere" } } }],
				{ "huge-wooden-sphere": ARCANUM_FLAGS },
			);
			stubGame(pack);
			const repo = new FoundryArcanaRepository();
			await repo.findBySlug("huge-wooden-sphere");
			await repo.findBySlug("huge-wooden-sphere");
			expect(pack.getDocument).toHaveBeenCalledTimes(1);
		});
	});

	describe("findBySlugs", () => {
		it("returns MinorArcanum instances for all matching arcana", async () => {
			const pack = makePack(
				[
					{ _id: "abc123xyz0000001", flags: { stonetop: { slug: "huge-wooden-sphere" } } },
					{ _id: "abc123xyz0000002", flags: { stonetop: { slug: "humble-broom" } } },
				],
				{ "huge-wooden-sphere": ARCANUM_FLAGS, "humble-broom": OTHER_FLAGS },
			);
			stubGame(pack);
			const repo = new FoundryArcanaRepository();
			const results = await repo.findBySlugs(["huge-wooden-sphere", "humble-broom"]);
			expect(results).toHaveLength(2);
			expect(results[0]).toBeInstanceOf(MinorArcanum);
			expect(results[0].slug).toBe("huge-wooden-sphere");
			expect(results[1]).toBeInstanceOf(MinorArcanum);
			expect(results[1].slug).toBe("humble-broom");
		});

		it("filters out slugs not in index", async () => {
			const pack = makePack(
				[{ _id: "abc123xyz0000001", flags: { stonetop: { slug: "huge-wooden-sphere" } } }],
				{ "huge-wooden-sphere": ARCANUM_FLAGS },
			);
			stubGame(pack);
			const repo = new FoundryArcanaRepository();
			const results = await repo.findBySlugs(["huge-wooden-sphere", "nonexistent"]);
			expect(results).toHaveLength(1);
			expect(results[0]).toBeInstanceOf(MinorArcanum);
			expect(results[0].slug).toBe("huge-wooden-sphere");
		});

		it("returns [] for empty slugs array", async () => {
			stubGame(makePack([], {}));
			const repo = new FoundryArcanaRepository();
			expect(await repo.findBySlugs([])).toEqual([]);
		});
	});
});
