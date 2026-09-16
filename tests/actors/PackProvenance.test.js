import { describe, it, expect } from "vitest";
import { PackProvenance } from "../../src/actors/PackProvenance.js";

// A pack store in the shape FoundryPackStore presents: index rows, found by predicate.
class FakeStore {
	constructor(entries = []) {
		this.entries = entries;
		this.lookups = 0;
	}

	async findEntry(predicate) {
		this.lookups++;
		return this.entries.find(predicate) ?? null;
	}
}

const row = (slug, id = slug, uuid = `Compendium.stonetop.moves.Item.${id}`) =>
	({ _id: id, uuid, system: { slug } });

function provenanceWith(stores = {}) {
	const made = new Map(Object.entries(stores));
	const provenance = new PackProvenance(packName => made.get(packName) ?? new FakeStore());
	return { provenance, store: name => made.get(name) };
}

describe("PackProvenance.uuidFor", () => {
	it("resolves an item type to the uuid its pack entry carries", async () => {
		const { provenance } = provenanceWith({ "stonetop.moves": new FakeStore([row("bulwark", "abc")]) });

		expect(await provenance.uuidFor("move", "bulwark")).toBe("Compendium.stonetop.moves.Item.abc");
	});

	it("reads each item type from its own pack", async () => {
		const { provenance } = provenanceWith({
			"stonetop.moves":       new FakeStore([row("bulwark", "abc")]),
			"stonetop.possessions": new FakeStore([{ _id: "p1", uuid: "Compendium.stonetop.possessions.Item.p1", system: { slug: "shield" } }]),
		});

		expect(await provenance.uuidFor("possession", "shield")).toBe("Compendium.stonetop.possessions.Item.p1");
	});

	it("composes a uuid when the index row carries none", async () => {
		const { provenance } = provenanceWith({ "stonetop.moves": new FakeStore([row("bulwark", "abc", undefined)]) });

		expect(await provenance.uuidFor("move", "bulwark")).toBe("Compendium.stonetop.moves.Item.abc");
	});

	it("is null for a slug no pack ships", async () => {
		const { provenance } = provenanceWith({ "stonetop.moves": new FakeStore([row("bulwark")]) });

		expect(await provenance.uuidFor("move", "home-brewed")).toBeNull();
	});

	it("is null for an item type with no pack of its own", async () => {
		const { provenance } = provenanceWith({});

		expect(await provenance.uuidFor("npc", "anything")).toBeNull();
	});

	it("is null without a type or a slug", async () => {
		const { provenance } = provenanceWith({});

		expect(await provenance.uuidFor("move", null)).toBeNull();
		expect(await provenance.uuidFor(null, "bulwark")).toBeNull();
	});

	// Granting a playbook resolves dozens of items at once; each miss would otherwise re-scan the index.
	it("looks a slug up once, hit or miss", async () => {
		const { provenance, store } = provenanceWith({ "stonetop.moves": new FakeStore([row("bulwark")]) });

		await provenance.uuidFor("move", "bulwark");
		await provenance.uuidFor("move", "bulwark");
		await provenance.uuidFor("move", "absent");
		await provenance.uuidFor("move", "absent");

		expect(store("stonetop.moves").lookups).toBe(2);
	});
});

describe("PackProvenance.sourced", () => {
	const movesPack = () => ({ "stonetop.moves": new FakeStore([row("bulwark", "abc")]) });
	const item = (over = {}) => ({ name: "Bulwark", type: "move", system: { slug: "bulwark" }, ...over });

	it("stamps the compendium source onto a copy that has none", async () => {
		const { provenance } = provenanceWith(movesPack());

		const out = await provenance.sourced(item());

		expect(out._stats.compendiumSource).toBe("Compendium.stonetop.moves.Item.abc");
	});

	it("leaves the payload otherwise untouched", async () => {
		const { provenance } = provenanceWith(movesPack());

		const out = await provenance.sourced(item({ system: { slug: "bulwark", acquired: true } }));

		expect(out.name).toBe("Bulwark");
		expect(out.system).toEqual({ slug: "bulwark", acquired: true });
	});

	it("does not mutate the payload it was given", async () => {
		const { provenance } = provenanceWith(movesPack());
		const original = item();

		await provenance.sourced(original);

		expect(original._stats).toBeUndefined();
	});

	// Core set it on the way through fromDropData; it may even name a pack we know nothing about.
	it("keeps a compendium source the payload already carries", async () => {
		const { provenance } = provenanceWith(movesPack());

		const out = await provenance.sourced(item({ _stats: { compendiumSource: "Compendium.other.moves.Item.zzz" } }));

		expect(out._stats.compendiumSource).toBe("Compendium.other.moves.Item.zzz");
	});

	it("keeps the rest of _stats when it stamps", async () => {
		const { provenance } = provenanceWith(movesPack());

		const out = await provenance.sourced(item({ _stats: { createdTime: 17 } }));

		expect(out._stats).toEqual({ createdTime: 17, compendiumSource: "Compendium.stonetop.moves.Item.abc" });
	});

	it("adds no _stats for an item no pack ships", async () => {
		const { provenance } = provenanceWith(movesPack());

		const out = await provenance.sourced(item({ system: { slug: "home-brewed" } }));

		expect(out._stats).toBeUndefined();
	});

	// The flags describe the COMPENDIUM document this was copied from, and `translated: true` on the
	// copy tells Babele there is nothing left to do — whatever language the copy's prose is in.
	it("drops the translation flags that rode along from the pack document", async () => {
		const { provenance } = provenanceWith(movesPack());

		const out = await provenance.sourced(item({
			flags: { babele: { translated: true, originalName: "Bulwark" }, stonetop: { grant: { source: "playbook:the-heavy" } } },
		}));

		expect(out.flags.babele).toBeUndefined();
		expect(out.flags.stonetop).toEqual({ grant: { source: "playbook:the-heavy" } });
	});

	it("leaves an item carrying no flags alone", async () => {
		const { provenance } = provenanceWith(movesPack());

		expect((await provenance.sourced(item())).flags).toBeUndefined();
	});

	it("hands back anything that is not an item payload", async () => {
		const { provenance } = provenanceWith(movesPack());

		expect(await provenance.sourced(null)).toBeNull();
	});
});
