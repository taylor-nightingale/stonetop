import { describe, it, expect } from "vitest";
import { GrantedItems } from "../../src/actors/GrantedItems.js";
import { ItemGrant, ItemGrantSet } from "../../src/model/data/ItemGrant.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";

const PLAYBOOK = "playbook:the-heavy";
const ARCANA   = "arcana:the-ring";

// An item already on the actor, stamped as granted by `source`.
function granted(id, source, key, system = {}) {
	const [type, slug] = key.split(":");
	return { _id: id, name: slug, type, system: { slug, ...system }, flags: { stonetop: { grant: { source, key } } } };
}

// An item the player added by hand — no stamp, nobody's grant.
function authored(id, name = "Hand added") {
	return { _id: id, name, type: "move", system: {} };
}

function grant(key, name = key) {
	const [type, slug] = key.split(":");
	return new ItemGrant({ name, type, system: { slug } });
}

function makeActor(...items) {
	const builder = new FakeCharacterActorBuilder();
	for (const item of items) builder.addItem(item);
	return builder.build();
}

describe("GrantedItems.itemsFrom", () => {
	it("returns only the items stamped with that source", () => {
		const actor = makeActor(
			granted("a", PLAYBOOK, "move:bulwark"),
			granted("b", ARCANA, "move:call-forth"),
			authored("c"),
		);
		expect(new GrantedItems(actor).itemsFrom(PLAYBOOK).map(i => i._id)).toEqual(["a"]);
	});
});

describe("GrantedItems.sync", () => {
	it("creates the items the source wants but doesn't have yet, stamped", async () => {
		const actor = makeActor();
		await new GrantedItems(actor).sync(new ItemGrantSet(PLAYBOOK, [grant("move:bulwark", "Bulwark")]));
		expect(actor.createdDocs).toHaveLength(1);
		expect(actor.createdDocs[0].name).toBe("Bulwark");
		expect(actor.createdDocs[0].flags.stonetop.grant).toEqual({ source: PLAYBOOK, key: "move:bulwark" });
	});

	it("leaves an item it already has completely alone — player state survives a re-grant", async () => {
		const actor = makeActor(granted("a", PLAYBOOK, "move:bulwark", { acquired: true, instanceCount: 2 }));
		await new GrantedItems(actor).sync(new ItemGrantSet(PLAYBOOK, [grant("move:bulwark")]));
		expect(actor.createdDocs).toEqual([]);
		expect(actor.deletedIds).toEqual([]);
		expect(actor.items.get("a").system).toEqual({ slug: "bulwark", acquired: true, instanceCount: 2 });
	});

	it("deletes an item the source no longer wants", async () => {
		const actor = makeActor(
			granted("a", PLAYBOOK, "move:bulwark"),
			granted("b", PLAYBOOK, "move:dropped-from-the-playbook"),
		);
		await new GrantedItems(actor).sync(new ItemGrantSet(PLAYBOOK, [grant("move:bulwark")]));
		expect(actor.deletedIds).toEqual(["b"]);
	});

	it("never touches another source's items", async () => {
		const actor = makeActor(granted("b", ARCANA, "move:call-forth"));
		await new GrantedItems(actor).sync(new ItemGrantSet(PLAYBOOK, [grant("move:bulwark")]));
		expect(actor.deletedIds).toEqual([]);
		expect(actor.items.get("b")).not.toBeNull();
	});

	it("never touches authored items", async () => {
		const actor = makeActor(authored("c"));
		await new GrantedItems(actor).sync(new ItemGrantSet(PLAYBOOK, [grant("move:bulwark")]));
		expect(actor.deletedIds).toEqual([]);
	});

	// An unloaded compendium resolves nothing. Reading that as "this playbook grants nothing now" would
	// delete what the character has; taking a source back is `revoke`, asked for on purpose.
	it("does nothing with an empty set", async () => {
		const actor = makeActor(granted("a", PLAYBOOK, "move:bulwark"), granted("b", PLAYBOOK, "move:armored"));
		await new GrantedItems(actor).sync(ItemGrantSet.empty(PLAYBOOK));
		expect(actor.deletedIds).toEqual([]);
	});

	it("writes nothing when the source already has exactly what it wants", async () => {
		const actor = makeActor(granted("a", PLAYBOOK, "move:bulwark"));
		await new GrantedItems(actor).sync(new ItemGrantSet(PLAYBOOK, [grant("move:bulwark")]));
		expect(actor.createdDocs).toEqual([]);
		expect(actor.deletedIds).toEqual([]);
	});

	it("is idempotent — syncing the same set twice adds nothing the second time", async () => {
		const actor = makeActor();
		const items = new GrantedItems(actor);
		const set   = new ItemGrantSet(PLAYBOOK, [grant("move:bulwark"), grant("move:armored")]);
		await items.sync(set);
		await items.sync(set);
		expect(actor.createdDocs).toHaveLength(2);
	});

	// The sheet finds a follower/insert/possession by slug and renders the first hit, so granting a
	// second copy beside one the player added by hand would be an invisible ghost.
	it("yields to an item the character already holds, whoever added it", async () => {
		const actor = makeActor({ _id: "hand", name: "Bulwark", type: "move", system: { slug: "bulwark" } });
		await new GrantedItems(actor).sync(new ItemGrantSet(PLAYBOOK, [grant("move:bulwark")]));
		expect(actor.createdDocs).toEqual([]);
	});

	it("does not revoke the item it yielded to — it never granted it", async () => {
		const actor = makeActor({ _id: "hand", name: "Bulwark", type: "move", system: { slug: "bulwark" } });
		const items = new GrantedItems(actor);
		await items.sync(new ItemGrantSet(PLAYBOOK, [grant("move:bulwark")]));
		await items.revoke(PLAYBOOK);
		expect(actor.deletedIds).toEqual([]);
	});

	it("yields to an item another source granted", async () => {
		const actor = makeActor(granted("b", ARCANA, "follower:the-ring"));
		await new GrantedItems(actor).sync(new ItemGrantSet(PLAYBOOK, [
			new ItemGrant({ name: "The Ring", type: "follower", system: { slug: "the-ring" } }),
		]));
		expect(actor.createdDocs).toEqual([]);
	});

	it("treats an existing duplicate as satisfying the key rather than adding a third copy", async () => {
		const actor = makeActor(granted("a", PLAYBOOK, "move:bulwark"), granted("b", PLAYBOOK, "move:bulwark"));
		await new GrantedItems(actor).sync(new ItemGrantSet(PLAYBOOK, [grant("move:bulwark")]));
		expect(actor.createdDocs).toEqual([]);
	});

	it("returns the items it created, so a caller can finish what only a new item needs", async () => {
		const actor = makeActor(granted("a", PLAYBOOK, "move:bulwark"));
		const created = await new GrantedItems(actor).sync(new ItemGrantSet(PLAYBOOK, [
			grant("move:bulwark"), grant("move:armored", "Armored"),
		]));
		expect(created.map(i => i.system.slug)).toEqual(["armored"]);
	});

	it("returns an empty list when it created nothing", async () => {
		const actor = makeActor(granted("a", PLAYBOOK, "move:bulwark"));
		expect(await new GrantedItems(actor).sync(new ItemGrantSet(PLAYBOOK, [grant("move:bulwark")]))).toEqual([]);
	});

	it("creates in one call, deletes in one call", async () => {
		const actor = makeActor(granted("a", PLAYBOOK, "move:stale-one"), granted("b", PLAYBOOK, "move:stale-two"));
		let creates = 0, deletes = 0;
		const create = actor.createEmbeddedDocuments.bind(actor);
		const remove = actor.deleteEmbeddedDocuments.bind(actor);
		actor.createEmbeddedDocuments = async (...args) => { creates++; return create(...args); };
		actor.deleteEmbeddedDocuments = async (...args) => { deletes++; return remove(...args); };
		await new GrantedItems(actor).sync(new ItemGrantSet(PLAYBOOK, [grant("move:new-one"), grant("move:new-two")]));
		expect(creates).toBe(1);
		expect(deletes).toBe(1);
	});
});

describe("GrantedItems.seed", () => {
	it("creates the missing items", async () => {
		const actor = makeActor(granted("a", "reference:basic", "move:defy-danger"));
		await new GrantedItems(actor).seed(new ItemGrantSet("reference:basic", [
			grant("move:defy-danger"), grant("move:seek-insight"),
		]));
		expect(actor.createdDocs).toHaveLength(1);
		expect(actor.createdDocs[0].flags.stonetop.grant.key).toBe("move:seek-insight");
	});

	it("keeps what the set no longer lists — a GM who deleted a reference move meant it", async () => {
		const actor = makeActor(granted("a", "reference:basic", "move:defy-danger"));
		await new GrantedItems(actor).seed(ItemGrantSet.empty("reference:basic"));
		expect(actor.deletedIds).toEqual([]);
	});
});

describe("GrantedItems.replace", () => {
	it("swaps the source's items for exactly the set", async () => {
		const actor = makeActor(granted("a", PLAYBOOK, "outfitItem:rope"));
		await new GrantedItems(actor).replace(new ItemGrantSet(PLAYBOOK, [grant("outfitItem:torch")]));
		expect(actor.deletedIds).toEqual(["a"]);
		expect(actor.createdDocs.map(i => i.system.slug)).toEqual(["torch"]);
	});

	// Two identical items from one source are two real items — a possession granting two rations.
	it("keeps identical items from the same source", async () => {
		const actor = makeActor();
		await new GrantedItems(actor).replace(new ItemGrantSet(PLAYBOOK, [
			grant("outfitItem:rations"), grant("outfitItem:rations"),
		]));
		expect(actor.createdDocs).toHaveLength(2);
	});

	it("does not yield to an item that is already there", async () => {
		const actor = makeActor({ _id: "hand", name: "Rope", type: "outfitItem", system: { slug: "rope" } });
		await new GrantedItems(actor).replace(new ItemGrantSet(PLAYBOOK, [grant("outfitItem:rope")]));
		expect(actor.createdDocs).toHaveLength(1);
		expect(actor.deletedIds).toEqual([]);
	});

	it("does nothing with an empty set — clearing gear is deleteBySource/revoke", async () => {
		const actor = makeActor(granted("a", PLAYBOOK, "outfitItem:rope"));
		await new GrantedItems(actor).replace(ItemGrantSet.empty(PLAYBOOK));
		expect(actor.deletedIds).toEqual([]);
	});
});

describe("GrantedItems.addAuthored", () => {
	it("creates the item with no stamp — nobody granted it", async () => {
		const actor = makeActor();
		await new GrantedItems(actor).addAuthored({ name: "Torch", type: "outfitItem", system: { slug: "torch" } });
		expect(actor.createdDocs[0].flags?.stonetop?.grant).toBeUndefined();
	});

	it("takes one item or many, and returns what it created", async () => {
		const actor = makeActor();
		const items = new GrantedItems(actor);
		expect(await items.addAuthored([])).toEqual([]);
		const created = await items.addAuthored([
			{ name: "A", type: "move", system: {} }, { name: "B", type: "move", system: {} },
		]);
		expect(created.map(i => i.name)).toEqual(["A", "B"]);
	});

	it("adds a second copy of something the character already has — that is the point", async () => {
		const actor = makeActor({ _id: "hand", name: "Bob", type: "follower", system: { slug: "custom-1" } });
		await new GrantedItems(actor).addAuthored({ name: "Bob", type: "follower", system: { slug: "custom-1" } });
		expect(actor.createdDocs).toHaveLength(1);
	});
});

describe("GrantedItems.revoke", () => {
	it("deletes everything from that source and nothing else", async () => {
		const actor = makeActor(
			granted("a", PLAYBOOK, "move:bulwark"),
			granted("b", ARCANA, "move:call-forth"),
			authored("c"),
		);
		await new GrantedItems(actor).revoke(PLAYBOOK);
		expect(actor.deletedIds).toEqual(["a"]);
	});

	it("writes nothing when the source granted nothing", async () => {
		const actor = makeActor(authored("c"));
		await new GrantedItems(actor).revoke(PLAYBOOK);
		expect(actor.deletedIds).toEqual([]);
	});
});
