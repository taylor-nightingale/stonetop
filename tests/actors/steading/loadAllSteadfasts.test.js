import { describe, it, expect, vi, afterEach } from "vitest";
import { loadAllSteadfasts } from "../../../src/actors/steading/applySteadfast.js";

function stubPack(docs) {
	vi.stubGlobal("game", {
		packs: { get: (name) => name === "stonetop.steadfasts" ? { getDocuments: async () => docs } : null },
	});
}

afterEach(() => vi.unstubAllGlobals());

describe("loadAllSteadfasts", () => {
	it("returns {slug, name} for each steadfast, ordered by sortOrder then name", async () => {
		stubPack([
			{ name: "Barrier Pass", system: { slug: "barrier-pass", sortOrder: 1 } },
			{ name: "Stonetop",     system: { slug: "stonetop",     sortOrder: 0 } },
		]);
		expect(await loadAllSteadfasts()).toEqual([
			{ slug: "stonetop", name: "Stonetop" },
			{ slug: "barrier-pass", name: "Barrier Pass" },
		]);
	});

	it("returns [] when the pack is absent", async () => {
		vi.stubGlobal("game", { packs: { get: () => null } });
		expect(await loadAllSteadfasts()).toEqual([]);
	});
});
