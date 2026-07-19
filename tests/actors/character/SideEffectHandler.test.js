import { describe, it, expect } from "vitest";
import { FollowerSideEffectHandler, OutfitItemSideEffectHandler } from "../../../src/actors/character/SideEffectHandler.js";
import { FakeFollowers } from "../../fakes/FakeFollowers.js";
import { FakeOutfitItems } from "../../fakes/FakeOutfitItems.js";

// ── FollowerSideEffectHandler ─────────────────────────────────────────────────

describe("FollowerSideEffectHandler", () => {
	it("adds followers from the target's follower link when count > 0", async () => {
		const followers = new FakeFollowers();
		const handler = new FollowerSideEffectHandler(followers);
		await handler.apply({ followers: { slugs: ["enfys", "afon"], inlineDisplay: false, hideFromFollowersTab: false } }, "ns", "opt", 1);
		expect(followers.isOwned("enfys")).toBe(true);
		expect(followers.isOwned("afon")).toBe(true);
	});

	it("removes followers from the target's follower link when count === 0", async () => {
		const followers = new FakeFollowers();
		await followers.addFollower("enfys");
		const handler = new FollowerSideEffectHandler(followers);
		await handler.apply({ followers: { slugs: ["enfys"] } }, "ns", "opt", 0);
		expect(followers.isOwned("enfys")).toBe(false);
	});

	it("no-ops when target has no followers field", async () => {
		const followers = new FakeFollowers();
		const handler = new FollowerSideEffectHandler(followers);
		await handler.apply({ type: "entry", slug: "opt" }, "ns", "opt", 1);
		expect(followers.owned).toHaveLength(0);
	});

	it("no-ops when the follower link has no slugs", async () => {
		const followers = new FakeFollowers();
		const handler = new FollowerSideEffectHandler(followers);
		await handler.apply({ followers: { slugs: [], inlineDisplay: true } }, "ns", "opt", 1);
		expect(followers.owned).toHaveLength(0);
	});

	it("no-ops on an unmigrated legacy slug array (migration owns the conversion)", async () => {
		const followers = new FakeFollowers();
		const handler = new FollowerSideEffectHandler(followers);
		await handler.apply({ followers: ["enfys"] }, "ns", "opt", 1);
		expect(followers.owned).toHaveLength(0);
	});
});

// ── OutfitItemSideEffectHandler ───────────────────────────────────────────────

const SWORD = { slug: "sword", name: "Sword" };

describe("OutfitItemSideEffectHandler", () => {
	it("syncs items when count > 0", async () => {
		const items = new FakeOutfitItems();
		const handler = new OutfitItemSideEffectHandler("bg", items);
		await handler.apply({ outfitItems: [SWORD] }, "initiate", "enfys", 1);
		expect(items.hasSource("bg:initiate:enfys")).toBe(true);
	});

	it("wraps each outfit item as a proper outfitItem payload (type + system + source)", async () => {
		const items = new FakeOutfitItems();
		const handler = new OutfitItemSideEffectHandler("bg", items);
		await handler.apply({ outfitItems: [SWORD] }, "initiate", "enfys", 1);
		const [created] = items.getItems("bg:initiate:enfys");
		expect(created.type).toBe("outfitItem");                 // was undefined → validation error
		expect(created.name).toBe("Sword");
		expect(created.system.slug).toBe("sword");
		expect(created.system.source).toBe("bg:initiate:enfys"); // so deleteBySource can find it
	});

	it("deletes items when count === 0", async () => {
		const items = new FakeOutfitItems();
		await items.sync("bg:initiate:enfys", [SWORD]);
		const handler = new OutfitItemSideEffectHandler("bg", items);
		await handler.apply({ outfitItems: [SWORD] }, "initiate", "enfys", 0);
		expect(items.hasSource("bg:initiate:enfys")).toBe(false);
	});

	it("no-ops when target.outfitItems is absent", async () => {
		const items = new FakeOutfitItems();
		const handler = new OutfitItemSideEffectHandler("bg", items);
		await handler.apply({ type: "entry", slug: "opt" }, "ns", "opt", 1);
		expect(items.hasSource("bg:ns:opt")).toBe(false);
	});

	it("no-ops when target.outfitItems is empty", async () => {
		const items = new FakeOutfitItems();
		const handler = new OutfitItemSideEffectHandler("bg", items);
		await handler.apply({ outfitItems: [] }, "ns", "opt", 1);
		expect(items.hasSource("bg:ns:opt")).toBe(false);
	});
});
