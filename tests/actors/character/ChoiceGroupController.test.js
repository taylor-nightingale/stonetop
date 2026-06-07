import { describe, expect, it } from "vitest";
import { ChoiceGroupFactory } from "../../../src/actors/character/ChoiceGroupFactory.js";
import { FollowerSideEffectHandler, OutfitItemSideEffectHandler } from "../../../src/actors/character/SideEffectHandler.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { FakeFollowers } from "../../fakes/FakeFollowers.js";
import { FakeOutfitItems } from "../../fakes/FakeOutfitItems.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtrl(choices = [], { followers = null, outfitItems = null } = {}) {
	const item   = { _id: "i1", type: "test", system: { choiceValues: {}, choices } };
	const actor  = new FakeActorBuilder().withItems([item]).build();
	const factory = new ChoiceGroupFactory(actor);
	if (followers)   factory.register(new FollowerSideEffectHandler(followers));
	if (outfitItems) factory.register(new OutfitItemSideEffectHandler(outfitItems.prefix, outfitItems.items));
	return { ctrl: factory.forItem("i1", "choiceValues"), actor };
}

function values(actor) { return actor.items.get("i1").system.choiceValues; }

// ── setCount ──────────────────────────────────────────────────────────────────

describe("ChoiceGroupController — setCount", () => {
	it("stores the count under namespace.optionSlug", async () => {
		const { ctrl, actor } = makeCtrl([{ slug: "ns", list: [{ type: "entry", slug: "opt", track: { max: 2 } }] }]);
		await ctrl.setCount("ns", "opt", 1);
		expect(values(actor)).toEqual({ ns: { opt: 1 } });
	});

	it("updates to the new count on re-call", async () => {
		const { ctrl, actor } = makeCtrl([{ slug: "ns", list: [{ type: "entry", slug: "opt", track: { max: 3 } }] }]);
		await ctrl.setCount("ns", "opt", 3);
		await ctrl.setCount("ns", "opt", 0);
		expect(values(actor).ns.opt).toBe(0);
	});

	it("two slugs in the same namespace are independent", async () => {
		const { ctrl, actor } = makeCtrl([{ slug: "ns", list: [
			{ type: "entry", slug: "a", track: { max: 1 } },
			{ type: "entry", slug: "b", track: { max: 1 } },
		]}]);
		await ctrl.setCount("ns", "a", 1);
		expect(values(actor).ns.a).toBe(1);
		expect(values(actor).ns.b).toBeUndefined();
	});

	it("two namespaces with the same option slug don't collide", async () => {
		const { ctrl, actor } = makeCtrl([
			{ slug: "ns1", list: [{ type: "entry", slug: "opt", track: { max: 1 } }] },
			{ slug: "ns2", list: [{ type: "entry", slug: "opt", track: { max: 1 } }] },
		]);
		await ctrl.setCount("ns1", "opt", 1);
		expect(values(actor).ns1?.opt).toBe(1);
		expect(values(actor).ns2?.opt).toBeUndefined();
	});
});

// ── selectOption ──────────────────────────────────────────────────────────────

describe("ChoiceGroupController — selectOption", () => {
	it("stores 1 under namespace.chosenSlug and 0 for siblings", async () => {
		const { ctrl, actor } = makeCtrl([{ slug: "ns", list: [{ type: "pick", pickCount: 1, options: [
			{ slug: "a", text: "A", description: "" },
			{ slug: "b", text: "B", description: "" },
		]}]}]);
		await ctrl.selectOption("ns", "a", "a,b");
		expect(values(actor).ns.a).toBe(1);
		expect(values(actor).ns.b).toBe(0);
	});

	it("switching selection clears the previous option", async () => {
		const { ctrl, actor } = makeCtrl([{ slug: "ns", list: [{ type: "pick", pickCount: 1, options: [
			{ slug: "a", text: "A", description: "" },
			{ slug: "b", text: "B", description: "" },
		]}]}]);
		await ctrl.selectOption("ns", "a", "a,b");
		await ctrl.selectOption("ns", "b", "a,b");
		expect(values(actor).ns.a).toBe(0);
		expect(values(actor).ns.b).toBe(1);
	});
});

// ── setText ───────────────────────────────────────────────────────────────────

describe("ChoiceGroupController — setText", () => {
	it("stores the string under namespace.optionSlug", async () => {
		const { ctrl, actor } = makeCtrl([]);
		await ctrl.setText("ns", "note", "hello");
		expect(values(actor)).toEqual({ ns: { note: "hello" } });
	});
});

// ── clearValues ───────────────────────────────────────────────────────────────

describe("ChoiceGroupController — clearValues", () => {
	it("removes the entire namespace", async () => {
		const { ctrl, actor } = makeCtrl([{ slug: "ns", list: [{ type: "entry", slug: "opt", track: { max: 1 } }] }]);
		await ctrl.setCount("ns", "opt", 1);
		await ctrl.clearValues("ns");
		expect(values(actor).ns).toBeUndefined();
	});

	it("leaves other namespaces intact", async () => {
		const { ctrl, actor } = makeCtrl([
			{ slug: "ns1", list: [{ type: "entry", slug: "opt", track: { max: 1 } }] },
			{ slug: "ns2", list: [{ type: "entry", slug: "opt", track: { max: 1 } }] },
		]);
		await ctrl.setCount("ns1", "opt", 1);
		await ctrl.setCount("ns2", "opt", 1);
		await ctrl.clearValues("ns1");
		expect(values(actor).ns1).toBeUndefined();
		expect(values(actor).ns2?.opt).toBe(1);
	});
});

// ── Follower side effects ─────────────────────────────────────────────────────

describe("ChoiceGroupController — follower side effects", () => {
	it("setCount(1) on legacy follower row adds the follower", async () => {
		const followers = new FakeFollowers();
		const { ctrl } = makeCtrl(
			[{ slug: "ns", list: [{ type: "follower", slug: "enfys", title: "Enfys", track: { max: 1 } }] }],
			{ followers },
		);
		await ctrl.setCount("ns", "enfys", 1);
		expect(followers.isOwned("enfys")).toBe(true);
	});

	it("setCount(0) on legacy follower row removes the follower", async () => {
		const followers = new FakeFollowers();
		const { ctrl } = makeCtrl(
			[{ slug: "ns", list: [{ type: "follower", slug: "enfys", title: "Enfys", track: { max: 1 } }] }],
			{ followers },
		);
		await ctrl.setCount("ns", "enfys", 1);
		await ctrl.setCount("ns", "enfys", 0);
		expect(followers.isOwned("enfys")).toBe(false);
	});

	it("setCount(1) on entry row with followers[] adds all followers", async () => {
		const followers = new FakeFollowers();
		const { ctrl } = makeCtrl(
			[{ slug: "ns", list: [{ type: "entry", slug: "duo", followers: ["enfys", "rook"], track: { max: 1 } }] }],
			{ followers },
		);
		await ctrl.setCount("ns", "duo", 1);
		expect(followers.isOwned("enfys")).toBe(true);
		expect(followers.isOwned("rook")).toBe(true);
	});

	it("selectOption fires addFollower for the chosen option's followers", async () => {
		const followers = new FakeFollowers();
		const { ctrl } = makeCtrl(
			[{ slug: "ns", list: [{ type: "pick", pickCount: 1, options: [
				{ slug: "a", text: "A", followers: ["enfys"] },
				{ slug: "b", text: "B" },
			]}]}],
			{ followers },
		);
		await ctrl.selectOption("ns", "a", "a,b");
		expect(followers.isOwned("enfys")).toBe(true);
	});

	it("switching pick option fires removeFollower for the previously selected option", async () => {
		const followers = new FakeFollowers();
		const { ctrl } = makeCtrl(
			[{ slug: "ns", list: [{ type: "pick", pickCount: 1, options: [
				{ slug: "a", text: "A", followers: ["enfys"] },
				{ slug: "b", text: "B", followers: ["rook"] },
			]}]}],
			{ followers },
		);
		await ctrl.selectOption("ns", "a", "a,b");
		await ctrl.selectOption("ns", "b", "a,b");
		expect(followers.isOwned("enfys")).toBe(false);
		expect(followers.isOwned("rook")).toBe(true);
	});

	it("entry row without followers does not add anything", async () => {
		const followers = new FakeFollowers();
		const { ctrl } = makeCtrl(
			[{ slug: "ns", list: [{ type: "entry", slug: "lore", track: { max: 1 } }] }],
			{ followers },
		);
		await ctrl.setCount("ns", "lore", 1);
		expect(followers.owned).toHaveLength(0);
	});

	it("no follower handler — setCount still persists value without error", async () => {
		const { ctrl, actor } = makeCtrl(
			[{ slug: "ns", list: [{ type: "follower", slug: "enfys", title: "Enfys", track: { max: 1 } }] }],
		);
		await ctrl.setCount("ns", "enfys", 1);
		expect(values(actor).ns.enfys).toBe(1);
	});
});

// ── OutfitItem side effects ───────────────────────────────────────────────────

describe("ChoiceGroupController — outfitItems side effects", () => {
	const SWORD = { slug: "sword", name: "Sword" };
	const BOW   = { slug: "bow",   name: "Bow" };

	it("selectOption syncs outfit items for the chosen pick option", async () => {
		const items = new FakeOutfitItems();
		const { ctrl } = makeCtrl(
			[{ slug: "weapons", list: [{ type: "pick", pickCount: 1, options: [
				{ slug: "sword-opt", text: "Sword", outfitItems: [SWORD] },
				{ slug: "bow-opt",   text: "Bow" },
			]}]}],
			{ outfitItems: { prefix: "cg", items } },
		);
		await ctrl.selectOption("weapons", "sword-opt", "sword-opt,bow-opt");
		expect(items.getItems("cg:weapons:sword-opt")).toEqual([SWORD]);
	});

	it("switching option removes previous outfit items and syncs new ones", async () => {
		const items = new FakeOutfitItems();
		const { ctrl } = makeCtrl(
			[{ slug: "weapons", list: [{ type: "pick", pickCount: 1, options: [
				{ slug: "sword-opt", text: "Sword", outfitItems: [SWORD] },
				{ slug: "bow-opt",   text: "Bow",   outfitItems: [BOW]   },
			]}]}],
			{ outfitItems: { prefix: "cg", items } },
		);
		await ctrl.selectOption("weapons", "sword-opt", "sword-opt,bow-opt");
		await ctrl.selectOption("weapons", "bow-opt",   "sword-opt,bow-opt");
		expect(items.hasSource("cg:weapons:sword-opt")).toBe(false);
		expect(items.getItems("cg:weapons:bow-opt")).toEqual([BOW]);
	});

	it("setCount(0) on entry row with outfitItems removes that source", async () => {
		const items = new FakeOutfitItems();
		const { ctrl } = makeCtrl(
			[{ slug: "ns", list: [{ type: "entry", slug: "kit", outfitItems: [SWORD], track: { max: 1 } }] }],
			{ outfitItems: { prefix: "poss", items } },
		);
		await ctrl.setCount("ns", "kit", 1);
		await ctrl.setCount("ns", "kit", 0);
		expect(items.hasSource("poss:ns:kit")).toBe(false);
	});

	it("uses the configured source prefix", async () => {
		const items = new FakeOutfitItems();
		const { ctrl } = makeCtrl(
			[{ slug: "ns", list: [{ type: "entry", slug: "kit", outfitItems: [SWORD], track: { max: 1 } }] }],
			{ outfitItems: { prefix: "possessions", items } },
		);
		await ctrl.setCount("ns", "kit", 1);
		expect(items.hasSource("possessions:ns:kit")).toBe(true);
	});
});
