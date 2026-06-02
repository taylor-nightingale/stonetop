import { describe, it, expect, vi, afterEach } from "vitest";
import { FoundrySteadingImprovementRepository } from "../../../../src/actors/steading/repositories/FoundrySteadingImprovementRepository.js";

function makeEntry(slug, sortOrder = 1, choices = null) {
	return {
		_id: `id-${slug}`,
		name: slug,
		type: "improvement",
		system: { slug, sortOrder, choices },
	};
}

function makePack(entries = []) {
	return { getIndex: vi.fn(async () => {}), index: entries, folders: [] };
}

function stubGame(pack) {
	vi.stubGlobal("game", { packs: { get: () => pack } });
}

describe("FoundrySteadingImprovementRepository", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("returns [] when pack is missing", async () => {
		vi.stubGlobal("game", { packs: { get: () => null } });
		const repo = new FoundrySteadingImprovementRepository();
		expect(await repo.getAll()).toEqual([]);
	});

	it("maps slug and choices from system", async () => {
		const choices = { slug: "inn", list: [] };
		stubGame(makePack([makeEntry("inn", 1, choices)]));
		const repo = new FoundrySteadingImprovementRepository();
		const items = await repo.getAll();
		expect(items[0].slug).toBe("inn");
		expect(items[0].choices).toEqual(choices);
	});

	it("defaults choices to null when absent", async () => {
		stubGame(makePack([makeEntry("mill")]));
		const repo = new FoundrySteadingImprovementRepository();
		const items = await repo.getAll();
		expect(items[0].choices).toBeNull();
	});

	it("sorts by sortOrder", async () => {
		stubGame(makePack([
			makeEntry("inn",  3),
			makeEntry("mill", 1),
			makeEntry("palisade", 2),
		]));
		const repo = new FoundrySteadingImprovementRepository();
		const items = await repo.getAll();
		expect(items.map(i => i.slug)).toEqual(["mill", "palisade", "inn"]);
	});

	it("caches results — getIndex called once", async () => {
		const pack = makePack([makeEntry("inn")]);
		stubGame(pack);
		const repo = new FoundrySteadingImprovementRepository();
		await repo.getAll();
		await repo.getAll();
		expect(pack.getIndex).toHaveBeenCalledTimes(1);
	});
});
