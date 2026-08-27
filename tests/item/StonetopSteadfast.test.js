import { describe, it, expect, vi } from "vitest";
import { StonetopSteadfast } from "../../src/item/StonetopSteadfast.js";
import { SteadfastSnapshot } from "../../src/model/snapshot/steading/SteadfastSnapshot.js";
import { createStonetopItemClass } from "../../src/item/StonetopItem.js";
import { SteadingImprovement } from "../../src/actors/steading/repositories/FoundrySteadingImprovementRepository.js";

// A steadfast item: the shared profile schema plus a name/img. `update` is a spy so we can assert what
// each edit writes. The composed controllers (SteadingAttributes/Assets/PlacesOfInterest/NeighborPlaces)
// only touch `.system`/`.update`, so this same fake exercises them end-to-end on an item.
function makeItem(overrides = {}) {
	return {
		name: "Barrier Pass",
		img:  "icons/svg/village.svg",
		system: {
			description: "A pass.",
			attributes: { fortunes: 1, surplus: 1, size: "village", population: 0, prosperity: 1, defenses: 2 },
			assets: { items: ["A cart"], resources: ["Timber"], fortifications: ["Ramparts"], coinage: [{ title: "gold", purses: 0, handfuls: 0, coins: 0 }] },
			placesOfInterest: [{ name: "The Gate", linkUuid: "" }],
			neighborPlaces: [{ slug: "stonetop", name: "Stonetop", subtitle: "", note: "", names: "" }],
			residents: { names: "Ana, Bram", traits: ["Gruff", "Kind"] },
			improvements: ["watchtower"],
			...overrides,
		},
		update: vi.fn(async () => {}),
	};
}

// Resolves any owned slug to a one-entry improvement choice group. Builds the real entity rather
// than a look-alike, so a test cannot come to depend on a shape the production repo never returns.
const fakeRepo = {
	getBySlug: async (slug) => new SteadingImprovement(slug, "Watchtower", {
		slug,
		list: [{ type: "entry", slug: "built", content: { title: null, text: "Keep watch." } }],
	}),
};

describe("StonetopSteadfast", () => {
	it("reports its type", () => {
		expect(new StonetopSteadfast(makeItem()).type).toBe("steadfast");
	});

	it("builds a SteadfastSnapshot carrying the profile sections", async () => {
		const snap = await new StonetopSteadfast(makeItem(), fakeRepo).buildSnapshot();
		expect(snap).toBeInstanceOf(SteadfastSnapshot);
		expect(snap.name).toBe("Barrier Pass");
		expect(snap.fortunes).toBe(1);
		expect(snap.surplus).toBe(1);
		expect(snap.attributes.size.current).toBe("village");
		expect(snap.attributes.prosperity.items).toEqual(["Timber"]);
		expect(snap.attributes.defenses.items).toEqual(["Ramparts"]);
		expect(snap.assets.items).toEqual(["A cart"]);
		expect(snap.placesOfInterest[0].value).toBe("The Gate");
		expect(snap.neighbors.places[0].name).toBe("Stonetop");
		expect(snap.residentNames).toBe("Ana, Bram");
		expect(snap.residentTraitsText).toBe("Gruff\nKind");
	});

	it("resolves granted improvement slugs to read-only choice groups", async () => {
		const snap = await new StonetopSteadfast(makeItem(), fakeRepo).buildSnapshot();
		expect(snap.improvements).toHaveLength(1);
		expect(snap.improvements[0].slug).toBe("watchtower");
	});

	it("writes the resident name pool through update", async () => {
		const item = makeItem();
		await new StonetopSteadfast(item).setResidentNames("Cyn, Dax");
		expect(item.update).toHaveBeenCalledWith({ "system.residents.names": "Cyn, Dax" });
	});

	it("writes the resident trait pool through update", async () => {
		const item = makeItem();
		await new StonetopSteadfast(item).setResidentTraits(["Bold"]);
		expect(item.update).toHaveBeenCalledWith({ "system.residents.traits": ["Bold"] });
	});

	it("grants a new improvement (and is idempotent for one already granted)", async () => {
		const item = makeItem();
		const s = new StonetopSteadfast(item);
		await s.grantImprovement("market");
		expect(item.update).toHaveBeenCalledWith({ "system.improvements": ["watchtower", "market"] });

		item.update.mockClear();
		await s.grantImprovement("watchtower");
		expect(item.update).not.toHaveBeenCalled();
	});

	it("revokes a granted improvement", async () => {
		const item = makeItem();
		await new StonetopSteadfast(item).revokeImprovement("watchtower");
		expect(item.update).toHaveBeenCalledWith({ "system.improvements": [] });
	});

	it("edits a backing-list entry through the composed attributes controller on the item", async () => {
		const item = makeItem();
		await new StonetopSteadfast(item).attributes.updateItemOnAttribute("prosperity", 0, "Ore");
		expect(item.update).toHaveBeenCalledWith({ "system.assets.resources": ["Ore"] });
	});

	it("edits a coinage denomination through the composed assets controller on the item", async () => {
		const item = makeItem();
		await new StonetopSteadfast(item).assets.updateCoins("gold", 5);
		expect(item.update).toHaveBeenCalledWith({ "system.assets": { ...item.system.assets, coinage: [{ title: "gold", purses: 0, handfuls: 0, coins: 5 }] } });
	});
});

describe("StonetopItem.typedItem", () => {
	const StonetopItem = createStonetopItemClass(class {});
	const make = (type) => Object.assign(new StonetopItem(), { type, system: {} });

	it("returns a cached StonetopSteadfast for a steadfast item", () => {
		const item = make("steadfast");
		const typed = item.typedItem;
		expect(typed).toBeInstanceOf(StonetopSteadfast);
		expect(item.typedItem).toBe(typed); // cached — same instance
	});

	it("returns null for a non-steadfast item", () => {
		expect(make("improvement").typedItem).toBeNull();
	});
});
