import { describe, it, expect, vi, afterEach } from "vitest";
import { FoundryPackStore } from "../../../../src/actors/character/repositories/FoundryPackStore.js";
import { TranslationCatalog } from "../../../../src/i18n/TranslationCatalog.js";

// -- Helpers ------------------------------------------------------------------

const ENTRY_A = { _id: "id001", system: { slug: "alpha" } };
const ENTRY_B = { _id: "id002", system: { slug: "beta" } };
const DOC_A   = { name: "Alpha Doc", system: { slug: "alpha" } };

function makePack(entries = [], docsById = {}) {
	return {
		getIndex:    vi.fn(async () => {}),
		index:       entries,
		getDocument: vi.fn(async (id) => docsById[id] ?? null),
	};
}

function stubGame(pack) {
	vi.stubGlobal("game", { packs: { get: () => pack } });
}

function stubGameNoPack() {
	vi.stubGlobal("game", { packs: { get: () => null } });
}

afterEach(() => vi.unstubAllGlobals());

// -- Tests --------------------------------------------------------------------

describe("FoundryPackStore", () => {
	describe("findEntry", () => {
		it("returns null when pack not registered", async () => {
			stubGameNoPack();
			const store = new FoundryPackStore("stonetop.test", ["system.slug"]);
			expect(await store.findEntry(e => e.system?.slug === "alpha")).toBeNull();
		});

		it("returns null when no entry matches predicate", async () => {
			stubGame(makePack([ENTRY_A], {}));
			const store = new FoundryPackStore("stonetop.test", ["system.slug"]);
			expect(await store.findEntry(e => e.system?.slug === "missing")).toBeNull();
		});

		it("returns matching entry", async () => {
			stubGame(makePack([ENTRY_A, ENTRY_B], {}));
			const store  = new FoundryPackStore("stonetop.test", ["system.slug"]);
			const result = await store.findEntry(e => e.system?.slug === "beta");
			expect(result).toEqual(ENTRY_B);
		});
	});

	describe("filterEntries", () => {
		it("returns [] when pack not registered", async () => {
			stubGameNoPack();
			const store = new FoundryPackStore("stonetop.test", ["system.slug"]);
			expect(await store.filterEntries(() => true)).toEqual([]);
		});

		it("returns only entries matching predicate", async () => {
			stubGame(makePack([ENTRY_A, ENTRY_B], {}));
			const store   = new FoundryPackStore("stonetop.test", ["system.slug"]);
			const results = await store.filterEntries(e => e.system?.slug === "alpha");
			expect(results).toHaveLength(1);
			expect(results[0]).toEqual(ENTRY_A);
		});

		it("returns all entries when predicate always true", async () => {
			stubGame(makePack([ENTRY_A, ENTRY_B], {}));
			const store = new FoundryPackStore("stonetop.test", ["system.slug"]);
			expect(await store.filterEntries(() => true)).toHaveLength(2);
		});
	});

	describe("getAll", () => {
		it("returns [] when pack not registered", async () => {
			stubGameNoPack();
			const store = new FoundryPackStore("stonetop.test", ["system.slug"]);
			expect(await store.getAll()).toEqual([]);
		});

		it("returns all index entries", async () => {
			stubGame(makePack([ENTRY_A, ENTRY_B], {}));
			const store = new FoundryPackStore("stonetop.test", ["system.slug"]);
			expect(await store.getAll()).toHaveLength(2);
		});
	});

	describe("getDocument", () => {
		it("returns null when pack not registered", async () => {
			stubGameNoPack();
			const store = new FoundryPackStore("stonetop.test", ["system.slug"]);
			expect(await store.getDocument("id001")).toBeNull();
		});

		it("returns the document by id", async () => {
			stubGame(makePack([ENTRY_A], { id001: DOC_A }));
			const store = new FoundryPackStore("stonetop.test", ["system.slug"]);
			expect(await store.getDocument("id001")).toEqual(DOC_A);
		});
	});

	describe("getIndex (via _ensureIndexed)", () => {
		it("passes the configured fields to getIndex", async () => {
			const pack = makePack([], {});
			stubGame(pack);
			const store = new FoundryPackStore("stonetop.test", ["system.slug", "system.name"]);
			await store.findEntry(() => false);
			expect(pack.getIndex).toHaveBeenCalledWith({ fields: ["system.slug", "system.name"] });
		});

		it("calls getIndex only once per instance even with multiple queries", async () => {
			const pack = makePack([ENTRY_A], {});
			stubGame(pack);
			const store = new FoundryPackStore("stonetop.test", ["system.slug"]);
			await store.findEntry(e => e.system?.slug === "alpha");
			await store.filterEntries(() => true);
			await store.getAll();
			expect(pack.getIndex).toHaveBeenCalledTimes(1);
		});
	});
});

describe("FoundryPackStore and the active language", () => {
	const PLAYBOOK_ENTRY = { _id: "id003", type: "playbook", name: "The Seeker", system: { slug: "the-seeker" } };
	const german = () => TranslationCatalog.fromTranslations({ playbook: { "the-seeker": { name: "Der Sucher" } } });

	afterEach(() => { TranslationCatalog.current = new TranslationCatalog(); });

	function storeWith(entries) {
		stubGame(makePack(entries, {}));
		return new FoundryPackStore("stonetop.playbooks", ["system.slug"]);
	}

	// A compendium index is not a document, so it never sees prepareBaseData. Without translating it
	// here, every picker built from the index stays English while the sheets it opens are translated.
	it("translates names on entries handed out by getAll, findEntry and filterEntries", async () => {
		TranslationCatalog.current = german();
		const store = storeWith([PLAYBOOK_ENTRY]);

		expect((await store.getAll())[0].name).toBe("Der Sucher");
		expect((await store.findEntry(e => e.system?.slug === "the-seeker")).name).toBe("Der Sucher");
		expect((await store.filterEntries(() => true))[0].name).toBe("Der Sucher");
	});

	it("leaves core's own index entry untouched", async () => {
		TranslationCatalog.current = german();
		const entry = { ...PLAYBOOK_ENTRY };
		const store = storeWith([entry]);

		await store.getAll();
		expect(entry.name).toBe("The Seeker");
	});

	it("keeps the fields a caller looks entries up by", async () => {
		TranslationCatalog.current = german();
		const [entry] = await storeWith([PLAYBOOK_ENTRY]).getAll();
		expect(entry._id).toBe("id003");
		expect(entry.system.slug).toBe("the-seeker");
	});

	it("hands out English when no translation is loaded", async () => {
		expect((await storeWith([PLAYBOOK_ENTRY]).getAll())[0].name).toBe("The Seeker");
	});
});
