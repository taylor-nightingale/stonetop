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
