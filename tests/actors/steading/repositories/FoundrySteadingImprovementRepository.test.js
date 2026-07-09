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

// The steading-improvements pack holds every improvement entry (both the Stonetop-core and the Book II
// wonder improvements now live there); any other pack name resolves to an empty stub.
function stubGame(pack) {
	vi.stubGlobal("game", { packs: { get: (name) => name === "stonetop.steading-improvements" ? pack : makePack([]) } });
}

// A world item (game.items) exposes `type` and toObject(); WorldItemStore reads game.items.contents.
function worldItem(slug, sortOrder = 1, choices = null) {
	const obj = { _id: `world-${slug}`, name: slug, type: "improvement", system: { slug, sortOrder, choices } };
	return { type: "improvement", toObject: () => obj };
}

function stubGameWithWorld(pack, worldItems = []) {
	vi.stubGlobal("game", {
		packs: { get: (name) => name === "stonetop.steading-improvements" ? pack : makePack([]) },
		items: { contents: worldItems },
	});
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

	it("includes custom improvements authored in the world", async () => {
		const choices = { slug: "watchtower", list: [] };
		stubGameWithWorld(makePack([makeEntry("inn", 1)]), [worldItem("watchtower", 2, choices)]);
		const repo = new FoundrySteadingImprovementRepository();
		const items = await repo.getAll();
		expect(items.map(i => i.slug)).toEqual(["inn", "watchtower"]);
		expect(items[1].choices).toEqual(choices);
	});

	it("interleaves pack and world improvements by sortOrder", async () => {
		stubGameWithWorld(
			makePack([makeEntry("inn", 1), makeEntry("mill", 4)]),
			[worldItem("watchtower", 2), worldItem("shrine", 3)],
		);
		const repo = new FoundrySteadingImprovementRepository();
		const items = await repo.getAll();
		expect(items.map(i => i.slug)).toEqual(["inn", "watchtower", "shrine", "mill"]);
	});

	it("returns world improvements even when the pack is missing", async () => {
		vi.stubGlobal("game", { packs: { get: () => null }, items: { contents: [worldItem("watchtower", 1)] } });
		const repo = new FoundrySteadingImprovementRepository();
		expect((await repo.getAll()).map(i => i.slug)).toEqual(["watchtower"]);
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
