import { describe, it, expect } from "vitest";
import { ItemGrantRouter } from "../../../src/actors/character/ItemGrantRouter.js";
import { ItemGrant, ItemGrantSet } from "../../../src/model/data/ItemGrant.js";

// Records what the router asked the store to do, without touching an actor.
class FakeGrantedItems {
	synced  = [];
	revoked = [];
	created = [];   // what the next sync should report as newly created
	async sync(set)      { this.synced.push(set); return this.created; }
	async revoke(source) { this.revoked.push(source); }
}

const playbook = { type: "playbook", system: { slug: "the-heavy" } };

function movesFor(item) {
	return new ItemGrantSet(`playbook:${item.system.slug}`, [new ItemGrant({ name: "Bulwark", type: "move", system: { slug: "bulwark" } })]);
}

function followersFor(item) {
	return new ItemGrantSet(`playbook:${item.system.slug}`, [new ItemGrant({ name: "Crew", type: "follower", system: { slug: "crew" } })]);
}

function makeRouter(store, overrides = {}) {
	return new ItemGrantRouter(store).register("playbook", {
		source: item => `playbook:${item.system.slug}`,
		grants: async item => [movesFor(item), followersFor(item)],
		...overrides,
	});
}

describe("ItemGrantRouter.apply", () => {
	// One source, one desired set: the builders are separate, the answer to "what does this playbook
	// want?" is not. Applied set by set, each would read as the source wanting nothing else.
	it("syncs everything the registered source grants as one set", async () => {
		const store = new FakeGrantedItems();
		await makeRouter(store).apply(playbook);
		expect(store.synced.map(s => s.keys)).toEqual([["move:bulwark", "follower:crew"]]);
	});

	it("ignores an item type nobody registered", async () => {
		const store = new FakeGrantedItems();
		await makeRouter(store).apply({ type: "equipment", system: { slug: "torch" } });
		expect(store.synced).toEqual([]);
	});

	it("ignores a missing item", async () => {
		const store = new FakeGrantedItems();
		await makeRouter(store).apply(undefined);
		expect(store.synced).toEqual([]);
	});

	it("runs the source's own consequences before its grants", async () => {
		const store = new FakeGrantedItems();
		const order = [];
		store.sync = async set => { order.push(`sync:${set.keys.join(",")}`); return []; };
		await makeRouter(store, { onApply: async () => order.push("onApply") }).apply(playbook);
		expect(order).toEqual(["onApply", "sync:move:bulwark,follower:crew"]);
	});

	it("hands the newly created items to onGranted", async () => {
		const store = new FakeGrantedItems();
		store.created = [{ _id: "new1", type: "insert" }];
		let granted = null;
		await makeRouter(store, { onGranted: async created => { granted = created; } }).apply(playbook);
		expect(granted.map(i => i._id)).toEqual(["new1"]);
	});

	it("skips onGranted when nothing was created", async () => {
		const store = new FakeGrantedItems();
		let called = false;
		await makeRouter(store, { onGranted: async () => { called = true; } }).apply(playbook);
		expect(called).toBe(false);
	});
});

describe("ItemGrantRouter.revoke", () => {
	it("revokes the same source the grants were applied under", async () => {
		const store = new FakeGrantedItems();
		const router = makeRouter(store);
		await router.apply(playbook);
		await router.revoke(playbook);
		expect(store.revoked).toEqual([...new Set(store.synced.map(s => s.source))]);
	});

	it("runs the registered cleanup before deleting the items", async () => {
		const store = new FakeGrantedItems();
		const order = [];
		store.revoke = async source => order.push(`revoke:${source}`);
		const router = makeRouter(store, { onRevoke: async source => order.push(`cleanup:${source}`) });
		await router.revoke(playbook);
		expect(order).toEqual(["cleanup:playbook:the-heavy", "revoke:playbook:the-heavy"]);
	});

	it("revokes without a cleanup hook registered", async () => {
		const store = new FakeGrantedItems();
		await makeRouter(store).revoke(playbook);
		expect(store.revoked).toEqual(["playbook:the-heavy"]);
	});

	it("ignores an item type nobody registered", async () => {
		const store = new FakeGrantedItems();
		await makeRouter(store).revoke({ type: "equipment", system: { slug: "torch" } });
		expect(store.revoked).toEqual([]);
	});
});

