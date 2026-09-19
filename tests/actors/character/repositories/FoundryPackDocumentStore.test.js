import { describe, it, expect, vi, afterEach } from "vitest";
import {
	FoundryPackDocumentStore,
	clearPackDocumentCache,
} from "../../../../src/actors/character/repositories/FoundryPackDocumentStore.js";

// -- Helpers ------------------------------------------------------------------

const doc = (id, slug, extra = {}) => ({
	uuid: `Compendium.stonetop.test.Item.${id}`,
	toObject: () => ({ _id: id, name: slug, type: "move", system: { slug, ...extra } }),
});

const DOC_A = doc("id001", "alpha", { description: "Ein Spielzug." });
const DOC_B = doc("id002", "beta");

function makePack(documents = [], docsById = {}) {
	return {
		getDocuments: vi.fn(async () => documents),
		getDocument:  vi.fn(async (id) => docsById[id] ?? null),
	};
}

const stubGame     = (pack) => vi.stubGlobal("game", { packs: { get: () => pack } });
const stubNoPack   = ()     => vi.stubGlobal("game", { packs: { get: () => null } });
/** A cache of this store's own, so one test cannot see what another loaded. */
const store        = (name = "stonetop.test") => new FoundryPackDocumentStore(name, new Map());

afterEach(() => {
	vi.unstubAllGlobals();
	clearPackDocumentCache();
});

// -- Tests --------------------------------------------------------------------

describe("FoundryPackDocumentStore", () => {
	describe("findEntry", () => {
		it("returns null when the pack is not registered", async () => {
			stubNoPack();
			expect(await store().findEntry(e => e.system?.slug === "alpha")).toBeNull();
		});

		it("returns null when nothing matches", async () => {
			stubGame(makePack([DOC_A]));
			expect(await store().findEntry(e => e.system?.slug === "missing")).toBeNull();
		});

		it("returns the matching entry", async () => {
			stubGame(makePack([DOC_A, DOC_B]));
			expect((await store().findEntry(e => e.system?.slug === "beta"))._id).toBe("id002");
		});
	});

	describe("filterEntries", () => {
		it("returns [] when the pack is not registered", async () => {
			stubNoPack();
			expect(await store().filterEntries(() => true)).toEqual([]);
		});

		it("returns only what matches", async () => {
			stubGame(makePack([DOC_A, DOC_B]));
			const found = await store().filterEntries(e => e.system?.slug === "alpha");
			expect(found).toHaveLength(1);
			expect(found[0].system.slug).toBe("alpha");
		});
	});

	describe("getAll", () => {
		it("returns [] when the pack is not registered", async () => {
			stubNoPack();
			expect(await store().getAll()).toEqual([]);
		});

		it("returns every document as a plain entry", async () => {
			stubGame(makePack([DOC_A, DOC_B]));
			expect(await store().getAll()).toHaveLength(2);
		});

		// The whole point: a document's `system` carries the translated prose an index entry never
		// gets, so the entry has to be the document's own data rather than an index row.
		it("carries the document's system data, not just its identity", async () => {
			stubGame(makePack([DOC_A]));
			const [entry] = await store().getAll();
			expect(entry.system).toEqual({ slug: "alpha", description: "Ein Spielzug." });
			expect(entry.name).toBe("alpha");
			expect(entry.type).toBe("move");
		});

		it("carries the uuid, which the document data does not restate", async () => {
			stubGame(makePack([DOC_A]));
			const [entry] = await store().getAll();
			expect(entry.uuid).toBe("Compendium.stonetop.test.Item.id001");
		});

		it("hands out a copy, so a caller cannot mutate what the next one reads", async () => {
			stubGame(makePack([DOC_A, DOC_B]));
			const s = store();
			(await s.getAll()).pop();
			expect(await s.getAll()).toHaveLength(2);
		});
	});

	describe("getDocument", () => {
		it("returns null when the pack is not registered", async () => {
			stubNoPack();
			expect(await store().getDocument("id001")).toBeNull();
		});

		it("returns the document by id", async () => {
			const full = { name: "Alpha" };
			stubGame(makePack([DOC_A], { id001: full }));
			expect(await store().getDocument("id001")).toEqual(full);
		});
	});

	describe("loading", () => {
		it("loads the pack once per instance however many queries are made", async () => {
			const pack = makePack([DOC_A]);
			stubGame(pack);
			const s = store();
			await s.findEntry(e => e.system?.slug === "alpha");
			await s.filterEntries(() => true);
			await s.getAll();
			expect(pack.getDocuments).toHaveBeenCalledTimes(1);
		});

		// The sheets build repositories per render, so the cache has to outlive the store instance or
		// every render reloads three hundred moves.
		it("loads the pack once across stores sharing a cache", async () => {
			const pack  = makePack([DOC_A]);
			stubGame(pack);
			const cache = new Map();
			await new FoundryPackDocumentStore("stonetop.test", cache).getAll();
			await new FoundryPackDocumentStore("stonetop.test", cache).getAll();
			expect(pack.getDocuments).toHaveBeenCalledTimes(1);
		});

		// Memoising the promise rather than the result is what makes concurrent callers share one load.
		it("loads once when callers arrive together", async () => {
			const pack  = makePack([DOC_A]);
			stubGame(pack);
			const cache = new Map();
			await Promise.all([
				new FoundryPackDocumentStore("stonetop.test", cache).getAll(),
				new FoundryPackDocumentStore("stonetop.test", cache).getAll(),
			]);
			expect(pack.getDocuments).toHaveBeenCalledTimes(1);
		});

		it("keeps separate packs separate", async () => {
			const cache = new Map();
			const packs = {
				"stonetop.a": makePack([DOC_A]),
				"stonetop.b": makePack([DOC_B]),
			};
			vi.stubGlobal("game", { packs: { get: (n) => packs[n] ?? null } });
			expect((await new FoundryPackDocumentStore("stonetop.a", cache).getAll())[0].system.slug).toBe("alpha");
			expect((await new FoundryPackDocumentStore("stonetop.b", cache).getAll())[0].system.slug).toBe("beta");
		});

		it("reloads after the cache is cleared", async () => {
			const pack = makePack([DOC_A]);
			stubGame(pack);
			await new FoundryPackDocumentStore("stonetop.test").getAll();
			clearPackDocumentCache();
			await new FoundryPackDocumentStore("stonetop.test").getAll();
			expect(pack.getDocuments).toHaveBeenCalledTimes(2);
		});
	});
});
