import { describe, it, expect, vi, afterEach } from "vitest";
import { FoundryPossessionRepository } from "../../../../src/actors/character/repositories/FoundryPossessionRepository.js";
import { Possession } from "../../../../src/model/data/character/Possession.js";

// -- Fixtures -----------------------------------------------------------------

const POSSESSION_SYSTEM = {
	slug:        "sacred-pouch",
	description: "A small pouch",
	resource:    { max: 3, title: "Stock", labels: [] },
	outfitItems: [],
	choices:     null,
	scaling:     null,
	sortOrder:   null,
};

const OTHER_SYSTEM = {
	slug:        "apiary",
	description: "Bees",
	resource:    null,
	outfitItems: [],
	choices:     null,
	scaling:     null,
	sortOrder:   null,
};

// -- Helpers ------------------------------------------------------------------

function makePack(entries = [], systemBySlug = {}) {
	return {
		getIndex: vi.fn(async () => {}),
		index: entries,
		getDocument: vi.fn(async (id) => {
			const entry = entries.find(e => e._id === id);
			const slug  = entry?.system?.slug;
			return { name: entry?.name, system: systemBySlug[slug] };
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

describe("FoundryPossessionRepository", () => {
	afterEach(() => vi.unstubAllGlobals());

	describe("findBySlug", () => {
		it("returns null when pack is not registered", async () => {
			stubGameNoPack();
			const repo = new FoundryPossessionRepository();
			expect(await repo.findBySlug("sacred-pouch")).toBeNull();
		});

		it("returns null when slug is not in index", async () => {
			stubGame(makePack([], {}));
			const repo = new FoundryPossessionRepository();
			expect(await repo.findBySlug("sacred-pouch")).toBeNull();
		});

		it("returns a Possession when slug is found", async () => {
			const pack = makePack(
				[{ _id: "abc123xyz0000001", name: "Sacred Pouch", system: { slug: "sacred-pouch" } }],
				{ "sacred-pouch": POSSESSION_SYSTEM },
			);
			stubGame(pack);
			const repo = new FoundryPossessionRepository();
			const result = await repo.findBySlug("sacred-pouch");
			expect(result).toBeInstanceOf(Possession);
			expect(result.slug).toBe("sacred-pouch");
			expect(result.name).toBe("Sacred Pouch");
			expect(result.resource.max).toBe(3);
		});

		it("calls getIndex with system.slug field", async () => {
			const pack = makePack([], {});
			stubGame(pack);
			const repo = new FoundryPossessionRepository();
			await repo.findBySlug("anything");
			expect(pack.getIndex).toHaveBeenCalledWith({ fields: ["system.slug"] });
		});

		it("caches the result — getDocument is not called a second time", async () => {
			const pack = makePack(
				[{ _id: "abc123xyz0000001", system: { slug: "sacred-pouch" } }],
				{ "sacred-pouch": POSSESSION_SYSTEM },
			);
			stubGame(pack);
			const repo = new FoundryPossessionRepository();
			await repo.findBySlug("sacred-pouch");
			await repo.findBySlug("sacred-pouch");
			expect(pack.getDocument).toHaveBeenCalledTimes(1);
		});
	});

	describe("findBySlugs", () => {
		it("returns Possession instances for all matching slugs", async () => {
			const pack = makePack(
				[
					{ _id: "abc123xyz0000001", system: { slug: "sacred-pouch" } },
					{ _id: "abc123xyz0000002", system: { slug: "apiary" } },
				],
				{ "sacred-pouch": POSSESSION_SYSTEM, "apiary": OTHER_SYSTEM },
			);
			stubGame(pack);
			const repo = new FoundryPossessionRepository();
			const results = await repo.findBySlugs(["sacred-pouch", "apiary"]);
			expect(results).toHaveLength(2);
			expect(results[0]).toBeInstanceOf(Possession);
			expect(results[0].slug).toBe("sacred-pouch");
			expect(results[1]).toBeInstanceOf(Possession);
			expect(results[1].slug).toBe("apiary");
		});

		it("filters out slugs not in index", async () => {
			const pack = makePack(
				[{ _id: "abc123xyz0000001", system: { slug: "sacred-pouch" } }],
				{ "sacred-pouch": POSSESSION_SYSTEM },
			);
			stubGame(pack);
			const repo = new FoundryPossessionRepository();
			const results = await repo.findBySlugs(["sacred-pouch", "nonexistent"]);
			expect(results).toHaveLength(1);
			expect(results[0]).toBeInstanceOf(Possession);
			expect(results[0].slug).toBe("sacred-pouch");
		});

		it("returns [] for empty slugs array", async () => {
			stubGame(makePack([], {}));
			const repo = new FoundryPossessionRepository();
			expect(await repo.findBySlugs([])).toEqual([]);
		});
	});
});
