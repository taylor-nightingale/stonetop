import { describe, it, expect } from "vitest";
import { migrateItemProvenance } from "../../src/migration/migrateItemProvenance.js";

const SOURCES = {
	"move:bulwark":        "Compendium.stonetop.moves.Item.abc",
	"possession:shield":   "Compendium.stonetop.possessions.Item.p1",
};

const provenance = {
	async uuidFor(type, slug) {
		return SOURCES[`${type}:${slug}`] ?? null;
	},
};

function actorWith(...items) {
	return {
		items,
		updates: [],
		async updateEmbeddedDocuments(_type, updates) {
			this.updates.push(...updates);
			return updates;
		},
	};
}

const item = (over = {}) => ({ _id: "i1", type: "move", name: "Bulwark", system: { slug: "bulwark" }, ...over });

describe("migrateItemProvenance", () => {
	it("stamps the compendium source on an item that has none", async () => {
		const actor = actorWith(item());

		await migrateItemProvenance(actor, provenance);

		expect(actor.updates).toEqual([
			{ _id: "i1", "_stats.compendiumSource": "Compendium.stonetop.moves.Item.abc" },
		]);
	});

	it("reaches every item type, not just moves", async () => {
		const actor = actorWith(item({ _id: "p", type: "possession", system: { slug: "shield" } }));

		await migrateItemProvenance(actor, provenance);

		expect(actor.updates[0]["_stats.compendiumSource"]).toBe("Compendium.stonetop.possessions.Item.p1");
	});

	it("leaves an item that already carries one alone", async () => {
		const actor = actorWith(item({ _stats: { compendiumSource: "Compendium.stonetop.moves.Item.abc" } }));

		await migrateItemProvenance(actor, provenance);

		expect(actor.updates).toEqual([]);
	});

	// A homebrew move belongs to nobody's compendium; inventing a source for it would be a lie.
	it("writes nothing for an item no pack ships", async () => {
		const actor = actorWith(item({ system: { slug: "home-brewed" } }));

		await migrateItemProvenance(actor, provenance);

		expect(actor.updates).toEqual([]);
	});

	it("deletes the translation flags that rode along from the pack document", async () => {
		const actor = actorWith(item({ flags: { babele: { translated: true } } }));

		await migrateItemProvenance(actor, provenance);

		expect(actor.updates[0]["flags.-=babele"]).toBeNull();
	});

	it("deletes them by key, so the old keys cannot survive Foundry's merge", async () => {
		const actor = actorWith(item({ flags: { babele: { translated: true } } }));

		await migrateItemProvenance(actor, provenance);

		expect(actor.updates[0]).not.toHaveProperty("flags.babele");
	});

	it("clears the flags even on an item whose source is already stamped", async () => {
		const actor = actorWith(item({
			_stats: { compendiumSource: "Compendium.stonetop.moves.Item.abc" },
			flags:  { babele: { translated: true } },
		}));

		await migrateItemProvenance(actor, provenance);

		expect(actor.updates).toEqual([{ _id: "i1", "flags.-=babele": null }]);
	});

	it("keeps the actor's other flags", async () => {
		const actor = actorWith(item({ flags: { babele: { translated: true }, stonetop: { grant: {} } } }));

		await migrateItemProvenance(actor, provenance);

		expect(actor.updates[0]).not.toHaveProperty("flags.-=stonetop");
	});

	it("does not write at all when every item is already in order", async () => {
		const actor = actorWith(item({ _stats: { compendiumSource: "Compendium.stonetop.moves.Item.abc" } }));

		await migrateItemProvenance(actor, provenance);

		expect(actor.updates).toEqual([]);
	});

	it("survives an actor with no items", async () => {
		const actor = { items: undefined, updates: [], async updateEmbeddedDocuments() {} };

		await expect(migrateItemProvenance(actor, provenance)).resolves.toBeUndefined();
	});
});
