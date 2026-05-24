import { describe, it, expect, vi, afterEach } from "vitest";
import { FoundryPostDeathInsertRepository } from "../../../../module/actors/character/repositories/FoundryPostDeathInsertRepository.js";
import { PostDeathInsert } from "../../../../module/model/data/character/PostDeathInsert.js";

// -- Fixtures -----------------------------------------------------------------

const INSERT_DOC = {
	name:   "Revenant",
	img:    "icons/svg/skull.png",
	system: { slug: "revenant", description: "<p>When you die...</p>" },
	flags:  { stonetop: { instinct: { slug: "instinct", list: [] }, lore: [] } },
};

const OTHER_DOC = {
	name:   "Ghost",
	img:    null,
	system: { slug: "ghost", description: "<p>When your soul lingers...</p>" },
	flags:  { stonetop: { instinct: null, lore: [] } },
};

// -- Helpers ------------------------------------------------------------------

function makePack(entries = [], docsBySlug = {}) {
	return {
		getIndex:    vi.fn(async () => {}),
		index:       entries,
		getDocument: vi.fn(async (id) => {
			const entry = entries.find(e => e._id === id);
			const slug  = entry?.system?.slug;
			return docsBySlug[slug] ?? null;
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

describe("FoundryPostDeathInsertRepository", () => {
	afterEach(() => vi.unstubAllGlobals());

	describe("getAll", () => {
		it("returns [] when pack not registered", async () => {
			stubGameNoPack();
			const repo = new FoundryPostDeathInsertRepository();
			expect(await repo.getAll()).toEqual([]);
		});

		it("returns {slug, name} for each index entry", async () => {
			const pack = makePack(
				[
					{ _id: "pDiRevenant00001", name: "Revenant", system: { slug: "revenant" } },
					{ _id: "pDiGhost0000001",  name: "Ghost",    system: { slug: "ghost" } },
				],
				{},
			);
			stubGame(pack);
			const repo    = new FoundryPostDeathInsertRepository();
			const results = await repo.getAll();
			expect(results).toEqual([
				{ slug: "revenant", name: "Revenant" },
				{ slug: "ghost",    name: "Ghost" },
			]);
		});
	});

	describe("findBySlug", () => {
		it("returns null when pack is not registered", async () => {
			stubGameNoPack();
			const repo = new FoundryPostDeathInsertRepository();
			expect(await repo.findBySlug("revenant")).toBeNull();
		});

		it("returns null when slug is not in index", async () => {
			stubGame(makePack([], {}));
			const repo = new FoundryPostDeathInsertRepository();
			expect(await repo.findBySlug("revenant")).toBeNull();
		});

		it("returns a PostDeathInsert when slug is found", async () => {
			const pack = makePack(
				[{ _id: "pDiRevenant00001", system: { slug: "revenant" } }],
				{ revenant: INSERT_DOC },
			);
			stubGame(pack);
			const repo   = new FoundryPostDeathInsertRepository();
			const result = await repo.findBySlug("revenant");
			expect(result).toBeInstanceOf(PostDeathInsert);
			expect(result.slug).toBe("revenant");
			expect(result.name).toBe("Revenant");
			expect(result.instinct).not.toBeNull();
		});

		it("calls getIndex with system.slug field", async () => {
			const pack = makePack([], {});
			stubGame(pack);
			const repo = new FoundryPostDeathInsertRepository();
			await repo.findBySlug("revenant");
			expect(pack.getIndex).toHaveBeenCalledWith({ fields: ["system.slug"] });
		});

		it("caches result — getDocument not called a second time", async () => {
			const pack = makePack(
				[{ _id: "pDiRevenant00001", system: { slug: "revenant" } }],
				{ revenant: INSERT_DOC },
			);
			stubGame(pack);
			const repo = new FoundryPostDeathInsertRepository();
			await repo.findBySlug("revenant");
			await repo.findBySlug("revenant");
			expect(pack.getDocument).toHaveBeenCalledTimes(1);
		});

		it("does not return a different slug's data", async () => {
			const pack = makePack(
				[
					{ _id: "pDiRevenant00001", system: { slug: "revenant" } },
					{ _id: "pDiGhost0000001", system: { slug: "ghost" } },
				],
				{ revenant: INSERT_DOC, ghost: OTHER_DOC },
			);
			stubGame(pack);
			const repo   = new FoundryPostDeathInsertRepository();
			const result = await repo.findBySlug("ghost");
			expect(result.slug).toBe("ghost");
			expect(result.name).toBe("Ghost");
		});
	});
});
