import { describe, expect, it } from "vitest";
import { ChoiceGroupControllerFactory } from "../../../src/actors/character/ChoiceGroupControllerFactory.js";
import { FollowerSideEffectHandler } from "../../../src/actors/character/SideEffectHandler.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeFollowers } from "../../fakes/FakeFollowers.js";
import { FakeOutfitItems } from "../../fakes/FakeOutfitItems.js";
import { ChoiceGroupController, applyPick } from "../../../src/actors/character/ChoiceGroupController.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtrl(choices = [], { followers = null } = {}) {
	const item   = { _id: "i1", type: "test", system: { choiceValues: {}, choices } };
	const actor  = new FakeCharacterActorBuilder().withItems([item]).build();
	const factory = new ChoiceGroupControllerFactory(actor);
	if (followers)   factory.subscribe(new FollowerSideEffectHandler(followers));
	return { ctrl: factory.forDocument("i1", "choiceValues"), actor };
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
	it("setCount(1) on an entry row with a single follower adds the follower", async () => {
		const followers = new FakeFollowers();
		const { ctrl } = makeCtrl(
			[{ slug: "ns", list: [{ type: "entry", slug: "enfys", grants: [{ type: "follower", slug: "enfys", locations: ["tab"] }], track: { max: 1 } }] }],
			{ followers },
		);
		await ctrl.setCount("ns", "enfys", 1);
		expect(followers.isOwned("enfys")).toBe(true);
	});

	it("setCount(0) on an entry row toggles its follower off the tab, keeps it owned", async () => {
		const followers = new FakeFollowers();
		const { ctrl } = makeCtrl(
			[{ slug: "ns", list: [{ type: "entry", slug: "enfys", grants: [{ type: "follower", slug: "enfys", locations: ["tab"] }], track: { max: 1 } }] }],
			{ followers },
		);
		await ctrl.setCount("ns", "enfys", 1);
		await ctrl.setCount("ns", "enfys", 0);
		expect(followers.isOwned("enfys")).toBe(true);
		expect(followers.showOnTab("enfys")).toBe(false);
	});

	it("setCount(1) on entry row with followers[] adds all followers", async () => {
		const followers = new FakeFollowers();
		const { ctrl } = makeCtrl(
			[{ slug: "ns", list: [{ type: "entry", slug: "duo", grants: [{ type: "follower", slug: "enfys", locations: ["tab"] }, { type: "follower", slug: "rook", locations: ["tab"] }], track: { max: 1 } }] }],
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
				{ slug: "a", text: "A", grants: [{ type: "follower", slug: "enfys", locations: ["tab"] }] },
				{ slug: "b", text: "B" },
			]}]}],
			{ followers },
		);
		await ctrl.selectOption("ns", "a", "a,b");
		expect(followers.isOwned("enfys")).toBe(true);
	});

	it("switching pick option toggles the deselected option's follower off the tab", async () => {
		const followers = new FakeFollowers();
		const { ctrl } = makeCtrl(
			[{ slug: "ns", list: [{ type: "pick", pickCount: 1, options: [
				{ slug: "a", text: "A", grants: [{ type: "follower", slug: "enfys", locations: ["tab"] }] },
				{ slug: "b", text: "B", grants: [{ type: "follower", slug: "rook", locations: ["tab"] }] },
			]}]}],
			{ followers },
		);
		await ctrl.selectOption("ns", "a", "a,b");
		await ctrl.selectOption("ns", "b", "a,b");
		expect(followers.showOnTab("enfys")).toBe(false);   // deselected → off the tab (still owned)
		expect(followers.showOnTab("rook")).toBe(true);     // selected → on the tab
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

