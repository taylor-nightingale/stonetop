import { describe, it, expect } from "vitest";
import { ChoiceGroupFactory } from "../../../src/actors/character/ChoiceGroupFactory.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { FakeFollowers } from "../../fakes/FakeFollowers.js";
import { FollowerSideEffectHandler, OutfitItemSideEffectHandler } from "../../../src/actors/character/SideEffectHandler.js";
import { FakeOutfitItems } from "../../fakes/FakeOutfitItems.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeItem(overrides = {}) {
	return {
		_id: "item-1", type: "test", name: "Test",
		system: { choiceValues: {}, choices: [], ...overrides.system },
		...overrides,
	};
}

function makeFactory(items = []) {
	const actor = new FakeActorBuilder().withItems(items).build();
	return { factory: new ChoiceGroupFactory(actor), actor };
}

// ── forItem ───────────────────────────────────────────────────────────────────

describe("ChoiceGroupFactory.forItem", () => {
	it("setCount writes to the item's value field", async () => {
		const item = makeItem({ system: { choiceValues: {}, choices: [
			{ slug: "ns", list: [{ type: "entry", slug: "opt", track: { max: 1 } }] },
		]}});
		const { factory, actor } = makeFactory([item]);
		await factory.forItem("item-1", "choiceValues").setCount("ns", "opt", 1);
		expect(actor.items.get("item-1").system.choiceValues).toEqual({ ns: { opt: 1 } });
	});

	it("selectOption writes the pick selection to the value field", async () => {
		const item = makeItem({ system: { choiceValues: {}, choices: [
			{ slug: "ns", list: [{ type: "pick", pickCount: 1, options: [
				{ slug: "a", text: "A", description: "" },
				{ slug: "b", text: "B", description: "" },
			]}]},
		]}});
		const { factory, actor } = makeFactory([item]);
		await factory.forItem("item-1", "choiceValues").selectOption("ns", "a", "a,b");
		expect(actor.items.get("item-1").system.choiceValues.ns.a).toBe(1);
		expect(actor.items.get("item-1").system.choiceValues.ns.b).toBe(0);
	});

	it("setText writes a string value to the value field", async () => {
		const item = makeItem({ system: { choiceValues: {}, choices: [] } });
		const { factory, actor } = makeFactory([item]);
		await factory.forItem("item-1", "choiceValues").setText("ns", "opt", "hello");
		expect(actor.items.get("item-1").system.choiceValues).toEqual({ ns: { opt: "hello" } });
	});

	it("clearValues removes the namespace from values", async () => {
		const item = makeItem({ system: { choiceValues: { ns: { opt: 1 } }, choices: [] } });
		const { factory, actor } = makeFactory([item]);
		await factory.forItem("item-1", "choiceValues").clearValues("ns");
		expect(actor.items.get("item-1").system.choiceValues).toEqual({});
	});

	it("uses the correct valueField", async () => {
		const item = makeItem({ system: { pickValues: {}, choices: [] } });
		const { factory, actor } = makeFactory([item]);
		await factory.forItem("item-1", "pickValues").setCount("ns", "opt", 1);
		expect(actor.items.get("item-1").system.pickValues).toEqual({ ns: { opt: 1 } });
	});

	it("default definition getter reads from item.system.choices array for side effects", async () => {
		const followers = new FakeFollowers();
		const item = makeItem({ system: { choiceValues: {}, choices: [
			{ slug: "ns", list: [{ type: "entry", slug: "companion", followers: ["enfys"] }] },
		]}});
		const { factory } = makeFactory([item]);
		factory.register(new FollowerSideEffectHandler(followers));
		await factory.forItem("item-1", "choiceValues").setCount("ns", "companion", 1);
		expect(followers.isOwned("enfys")).toBe(true);
	});

	it("default definition getter falls back to single-object system.choices", async () => {
		const followers = new FakeFollowers();
		const item = makeItem({ system: { pickValues: {}, choices: {
			slug: "ns",
			list: [{ type: "entry", slug: "companion", followers: ["enfys"] }],
		}}});
		const { factory } = makeFactory([item]);
		factory.register(new FollowerSideEffectHandler(followers));
		await factory.forItem("item-1", "pickValues").setCount("ns", "companion", 1);
		expect(followers.isOwned("enfys")).toBe(true);
	});

	it("default definition getter falls back to item.system.back.choices", async () => {
		const followers = new FakeFollowers();
		const item = makeItem({ system: { backChoiceValues: {}, back: { choices: {
			slug: "ns",
			list: [{ type: "entry", slug: "companion", followers: ["enfys"] }],
		}}}});
		const { factory } = makeFactory([item]);
		factory.register(new FollowerSideEffectHandler(followers));
		await factory.forItem("item-1", "backChoiceValues").setCount("ns", "companion", 1);
		expect(followers.isOwned("enfys")).toBe(true);
	});
});

// ── forItemType ───────────────────────────────────────────────────────────────

describe("ChoiceGroupFactory.forItemType", () => {
	it("writes to the item found by type", async () => {
		const item = { _id: "pb-1", type: "playbook", name: "The Blessed", system: { choiceValues: {}, choices: [] } };
		const { factory, actor } = makeFactory([item]);
		await factory.forItemType("playbook", "choiceValues").setCount("ns", "opt", 1);
		expect(actor.items.get("pb-1").system.choiceValues).toEqual({ ns: { opt: 1 } });
	});

	it("re-resolves item on each write — follows item replacement", async () => {
		const item1 = { _id: "pb-1", type: "playbook", name: "The Blessed", system: { choiceValues: {} } };
		const { factory, actor } = makeFactory([item1]);
		const ctrl = factory.forItemType("playbook", "choiceValues");

		await actor.deleteEmbeddedDocuments("Item", ["pb-1"]);
		const [item2] = await actor.createEmbeddedDocuments("Item", [
			{ type: "playbook", name: "The Fox", system: { choiceValues: {} } },
		]);

		await ctrl.setCount("ns", "opt", 1);

		expect(actor.items.get("pb-1")).toBeNull();
		expect(actor.items.get(item2._id).system.choiceValues).toEqual({ ns: { opt: 1 } });
	});

	it("no-ops when no item of the given type exists", async () => {
		const { factory, actor } = makeFactory([]);
		await factory.forItemType("playbook", "choiceValues").setCount("ns", "opt", 1);
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("uses provided definitionGetter for side effects", async () => {
		const followers = new FakeFollowers();
		const item = { _id: "pb-1", type: "playbook", name: "The Blessed", system: {
			choiceValues: {},
			instinct: { slug: "instinct", list: [{ type: "entry", slug: "guide", followers: ["enfys"] }] },
		}};
		const { factory } = makeFactory([item]);
		factory.register(new FollowerSideEffectHandler(followers));
		const ctrl = factory.forItemType("playbook", "choiceValues",
			(ns, item) => ns === "instinct" ? item?.system?.instinct : null,
		);
		await ctrl.setCount("instinct", "guide", 1);
		expect(followers.isOwned("enfys")).toBe(true);
	});
});

// ── register ──────────────────────────────────────────────────────────────────

describe("ChoiceGroupFactory — register", () => {
	it("handler registered after forItem call fires on subsequent mutations", async () => {
		const followers = new FakeFollowers();
		const item = makeItem({ system: { choiceValues: {}, choices: [
			{ slug: "ns", list: [{ type: "entry", slug: "companion", followers: ["enfys"] }] },
		]}});
		const { factory } = makeFactory([item]);
		const ctrl = factory.forItem("item-1", "choiceValues");
		factory.register(new FollowerSideEffectHandler(followers));
		await ctrl.setCount("ns", "companion", 1);
		expect(followers.isOwned("enfys")).toBe(true);
	});

	it("multiple handlers are called in registration order", async () => {
		const order = [];
		const h1 = { async apply() { order.push(1); } };
		const h2 = { async apply() { order.push(2); } };
		const item = makeItem({ system: { choiceValues: {}, choices: [
			{ slug: "ns", list: [{ type: "entry", slug: "opt", track: { max: 1 } }] },
		]}});
		const { factory } = makeFactory([item]);
		factory.register(h1).register(h2);
		await factory.forItem("item-1", "choiceValues").setCount("ns", "opt", 1);
		expect(order).toEqual([1, 2]);
	});

	it("OutfitItemSideEffectHandler syncs items when a pick option with outfitItems is selected", async () => {
		const outfitItems = new FakeOutfitItems();
		const SWORD = { slug: "sword", name: "Sword" };
		const item = makeItem({ system: { choiceValues: {}, choices: [
			{ slug: "gear", list: [{ type: "pick", pickCount: 1, options: [
				{ slug: "blade", text: "Blade", description: "", outfitItems: [SWORD] },
			]}]},
		]}});
		const { factory } = makeFactory([item]);
		factory.register(new OutfitItemSideEffectHandler("choice", outfitItems));
		await factory.forItem("item-1", "choiceValues").selectOption("gear", "blade", "blade");
		expect(outfitItems.hasSource("choice:gear:blade")).toBe(true);
	});

	it("returns the factory for chaining", () => {
		const { factory } = makeFactory([]);
		expect(factory.register({ async apply() {} })).toBe(factory);
	});
});
