import { describe, it, expect } from "vitest";
import { ContainerOutfitSync } from "../../../src/actors/character/ContainerOutfitSync.js";
import { OutfitGrant } from "../../../src/model/data/character/OutfitGrant.js";
import { FakeOutfitItems } from "../../fakes/FakeOutfitItems.js";

const gear = (slug) => ({ slug, name: slug, weight: 1, inventoryColumn: "regular" });

function grantOf(source, ...slugs) {
	return OutfitGrant.forContainer(source, slugs.map(gear), {}, {});
}

function makeSync() {
	const outfit = new FakeOutfitItems();
	return { outfit, sync: new ContainerOutfitSync(outfit) };
}

describe("ContainerOutfitSync", () => {
	it("dispatches to the builder registered for the item's type", async () => {
		const { outfit, sync } = makeSync();
		sync.register("possession", item => grantOf("possession:" + item.system.slug, "sword"));

		await sync.syncItem({ type: "possession", system: { slug: "wow" } });

		expect(outfit.getSlugs("possession:wow")).toEqual(["sword"]);
	});

	it("no-ops for an item type nobody registered", async () => {
		const { outfit, sync } = makeSync();
		await sync.syncItem({ type: "insert", system: { slug: "x" } });
		expect(outfit.deletedSources).toEqual([]);
		expect(outfit.allSlugs).toEqual([]);
	});

	it("clears the source when the container grants nothing", async () => {
		const { outfit, sync } = makeSync();
		sync.register("possession", () => OutfitGrant.empty("possession:wow"));
		await outfit.sync("possession:wow", [{ system: { slug: "stale" } }]);

		await sync.syncItem({ type: "possession", system: { slug: "wow" } });

		expect(outfit.hasSource("possession:wow")).toBe(false);
	});

	it("is idempotent — syncing twice leaves one copy, not two", async () => {
		const { outfit, sync } = makeSync();
		sync.register("possession", item => grantOf("possession:" + item.system.slug, "sword"));
		const item = { type: "possession", system: { slug: "wow" } };

		await sync.syncItem(item);
		await sync.syncItem(item);

		expect(outfit.allSlugs).toEqual(["sword"]);
	});

	it("replaces the whole source rather than appending to it", async () => {
		const { outfit, sync } = makeSync();
		let picked = "sword";
		sync.register("possession", item => grantOf("possession:" + item.system.slug, picked));
		const item = { type: "possession", system: { slug: "wow" } };

		await sync.syncItem(item);
		picked = "spear";
		await sync.syncItem(item);

		expect(outfit.allSlugs).toEqual(["spear"]);
	});

	it("clear() removes a container's source outright", async () => {
		const { outfit, sync } = makeSync();
		await outfit.sync("possession:wow", [{ system: { slug: "sword" } }]);

		await sync.clear("possession:wow");

		expect(outfit.hasSource("possession:wow")).toBe(false);
	});
});
