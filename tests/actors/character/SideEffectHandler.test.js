import { describe, it, expect } from "vitest";
import { FollowerSideEffectHandler, OutfitItemSideEffectHandler } from "../../../src/actors/character/SideEffectHandler.js";
import { FakeFollowers } from "../../fakes/FakeFollowers.js";
import { FakeOutfitItems } from "../../fakes/FakeOutfitItems.js";

// ── FollowerSideEffectHandler ─────────────────────────────────────────────────

describe("FollowerSideEffectHandler", () => {
	it("adds followers from target.followers when count > 0", async () => {
		const followers = new FakeFollowers();
		const handler = new FollowerSideEffectHandler(followers);
		await handler.apply({ followers: ["enfys", "afon"] }, "ns", "opt", 1);
		expect(followers.isOwned("enfys")).toBe(true);
		expect(followers.isOwned("afon")).toBe(true);
	});

	it("removes followers from target.followers when count === 0", async () => {
		const followers = new FakeFollowers();
		await followers.addFollower("enfys");
		const handler = new FollowerSideEffectHandler(followers);
		await handler.apply({ followers: ["enfys"] }, "ns", "opt", 0);
		expect(followers.isOwned("enfys")).toBe(false);
	});

	it("handles legacy target.type === 'follower' using target.slug", async () => {
		const followers = new FakeFollowers();
		const handler = new FollowerSideEffectHandler(followers);
		await handler.apply({ type: "follower", slug: "gwendyl" }, "ns", "opt", 1);
		expect(followers.isOwned("gwendyl")).toBe(true);
	});

	it("removes via legacy type when count === 0", async () => {
		const followers = new FakeFollowers();
		await followers.addFollower("gwendyl");
		const handler = new FollowerSideEffectHandler(followers);
		await handler.apply({ type: "follower", slug: "gwendyl" }, "ns", "opt", 0);
		expect(followers.isOwned("gwendyl")).toBe(false);
	});

	it("no-ops when target has no followers and is not type follower", async () => {
		const followers = new FakeFollowers();
		const handler = new FollowerSideEffectHandler(followers);
		await handler.apply({ type: "entry", slug: "opt" }, "ns", "opt", 1);
		expect(followers.owned).toHaveLength(0);
	});

	it("no-ops when target.followers is empty array", async () => {
		const followers = new FakeFollowers();
		const handler = new FollowerSideEffectHandler(followers);
		await handler.apply({ followers: [] }, "ns", "opt", 1);
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
