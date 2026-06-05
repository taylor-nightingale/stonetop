import { describe, expect, it } from "vitest";
import { ChoiceGroupController } from "../../../src/actors/character/ChoiceGroupController.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { FakeFollowers } from "../../fakes/FakeFollowers.js";
import { FakeOutfitItems } from "../../fakes/FakeOutfitItems.js";
import { TestChoiceGroupBuilder } from "../../fakes/TestChoiceGroupBuilder.js";
import { TestChoiceRowBuilder } from "../../fakes/TestChoiceRowBuilder.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeActor() { return new FakeActorBuilder().build(); }

function makeController(followers = new FakeFollowers()) {
	return ChoiceGroupController.forActorSection(makeActor(), "choices", { followers });
}

function makeItemWithChoices(choices = [], valueField = "choiceValues") {
	const item = {
		_id:    "item-1",
		type:   "arcanum",
		name:   "Test Item",
		system: { [valueField]: {}, choices },
	};
	return { actor: new FakeActorBuilder().withItems([item]).build(), itemId: "item-1" };
}

// ── Heading rows ──────────────────────────────────────────────────────────────

describe("ChoiceGroupController — heading rows", () => {
	it("heading without track has null track", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("no-track"))
			.build());

		const snap = ctrl.buildGroupSnapshot("ns");
		expect(snap.list[0].type).toBe("entry");
		expect(snap.list[0].slug).toBe("no-track");
		expect(snap.list[0].track).toBeNull();
	});

	it("heading with track starts with all checks false", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("my-track").withTrack(2))
			.build());

		const snap = ctrl.buildGroupSnapshot("ns");
		expect(snap.list[0].slug).toBe("my-track");
		expect(snap.list[0].track.slug).toBe("my-track");
		expect(snap.list[0].track.checks).toEqual([false, false]);
	});

	it("setCount partially fills track checks", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("my-track").withTrack(2))
			.build());

		await ctrl.setCount("ns", "my-track", 1);

		expect(ctrl.buildGroupSnapshot("ns").list[0].track.checks).toEqual([true, false]);
	});

	it("setCount to max fills all checks", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("my-track").withTrack(3))
			.build());

		await ctrl.setCount("ns", "my-track", 3);

		expect(ctrl.buildGroupSnapshot("ns").list[0].track.checks).toEqual([true, true, true]);
	});

	it("setCount to 0 clears all checks", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("my-track").withTrack(2))
			.build());

		await ctrl.setCount("ns", "my-track", 2);
		await ctrl.setCount("ns", "my-track", 0);

		expect(ctrl.buildGroupSnapshot("ns").list[0].track.checks).toEqual([false, false]);
	});

	it("multiple headings in one group track their checks independently", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("track-a").withTrack(1))
			.addChoice(TestChoiceRowBuilder.heading().withSlug("track-b").withTrack(1))
			.build());

		await ctrl.setCount("ns", "track-a", 1);

		const snap = ctrl.buildGroupSnapshot("ns");
		expect(snap.list[0].track.checks[0]).toBe(true);
		expect(snap.list[1].track.checks[0]).toBe(false);
	});
});

// ── Pick rows ─────────────────────────────────────────────────────────────────

describe("ChoiceGroupController — pick rows", () => {
	it("all options are unchecked before any selection", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.pick().withOptions(
				{ slug: "tall", text: "Tall" },
				{ slug: "short", text: "Short" },
			))
			.build());

		const row = ctrl.buildGroupSnapshot("ns").list[0];
		expect(row.options.every(o => !o.checked)).toBe(true);
	});

	it("selectOption marks the chosen option checked and clears siblings", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.pick().withOptions(
				{ slug: "tall",  text: "Tall" },
				{ slug: "short", text: "Short" },
			))
			.build());

		await ctrl.selectOption("ns", "tall", "tall,short");

		const row = ctrl.buildGroupSnapshot("ns").list[0];
		expect(row.options.find(o => o.slug === "tall").checked).toBe(true);
		expect(row.options.find(o => o.slug === "short").checked).toBe(false);
	});

	it("re-selecting a different option clears the previous one", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.pick().withOptions(
				{ slug: "tall",  text: "Tall" },
				{ slug: "short", text: "Short" },
			))
			.build());

		await ctrl.selectOption("ns", "tall", "tall,short");
		await ctrl.selectOption("ns", "short", "tall,short");

		const row = ctrl.buildGroupSnapshot("ns").list[0];
		expect(row.options.find(o => o.slug === "tall").checked).toBe(false);
		expect(row.options.find(o => o.slug === "short").checked).toBe(true);
	});
});

// ── Input rows ────────────────────────────────────────────────────────────────

describe("ChoiceGroupController — input rows", () => {
	it("input.value is empty string before any mutation", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("note").withInput(null))
			.build());

		expect(ctrl.buildGroupSnapshot("ns").list[0].input.value).toBe("");
	});

	it("input.placeholder comes from group data", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("note").withInput("e.g. level 2"))
			.build());

		expect(ctrl.buildGroupSnapshot("ns").list[0].input.placeholder).toBe("e.g. level 2");
	});

	it("setText with input slug updates input.value in the snapshot", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("note").withInput(null))
			.build());

		await ctrl.setText("ns", "note-input", "hello world");

		expect(ctrl.buildGroupSnapshot("ns").list[0].input.value).toBe("hello world");
	});
});

// ── Follower rows ─────────────────────────────────────────────────────────────

describe("ChoiceGroupController — follower rows", () => {
	it("follower track starts unchecked", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.follower().withSlug("enfys").withTitle("Enfys"))
			.build());

		expect(ctrl.buildGroupSnapshot("ns").list[0].track.checks[0]).toBe(false);
	});

	it("setCount(1) on a follower row marks the track checked and adds the follower", async () => {
		const followers = new FakeFollowers();
		const ctrl = makeController(followers);
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.follower().withSlug("enfys").withTitle("Enfys"))
			.build());

		await ctrl.setCount("ns", "enfys", 1);

		expect(ctrl.buildGroupSnapshot("ns").list[0].track.checks[0]).toBe(true);
		expect(followers.isOwned("enfys")).toBe(true);
	});

	it("setCount(0) on a follower row marks the track unchecked and removes the follower", async () => {
		const followers = new FakeFollowers();
		const ctrl = makeController(followers);
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.follower().withSlug("enfys").withTitle("Enfys"))
			.build());

		await ctrl.setCount("ns", "enfys", 1);
		await ctrl.setCount("ns", "enfys", 0);

		expect(ctrl.buildGroupSnapshot("ns").list[0].track.checks[0]).toBe(false);
		expect(followers.isOwned("enfys")).toBe(false);
	});

	it("setCount on a heading row does not add to followers", async () => {
		const followers = new FakeFollowers();
		const ctrl = makeController(followers);
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("a-track").withTrack(1))
			.build());

		await ctrl.setCount("ns", "a-track", 1);

		expect(followers.owned).toHaveLength(0);
	});

	it("setCount on a follower row without a followers handler persists count but has no side effect", async () => {
		const ctrl = ChoiceGroupController.forActorSection(makeActor(), "choices");
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.follower().withSlug("enfys").withTitle("Enfys"))
			.build());

		await ctrl.setCount("ns", "enfys", 1);

		expect(ctrl.buildGroupSnapshot("ns").list[0].track.checks[0]).toBe(true);
	});
});

// ── Namespace isolation ───────────────────────────────────────────────────────

describe("ChoiceGroupController — namespace isolation", () => {
	it("two namespaces with the same internal choice slug do not collide", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("initiate", new TestChoiceGroupBuilder().withSlug("choices")
			.addChoice(TestChoiceRowBuilder.heading().withSlug("track-a").withTrack(1))
			.build());
		await ctrl.addGroup("vessel", new TestChoiceGroupBuilder().withSlug("choices")
			.addChoice(TestChoiceRowBuilder.heading().withSlug("track-a").withTrack(1))
			.build());

		await ctrl.setCount("initiate", "track-a", 1);

		expect(ctrl.buildGroupSnapshot("initiate").list[0].track.checks[0]).toBe(true);
		expect(ctrl.buildGroupSnapshot("vessel").list[0].track.checks[0]).toBe(false);
	});

	it("setting counts in two namespaces independently tracks each correctly", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns-1", new TestChoiceGroupBuilder().withSlug("choices")
			.addChoice(TestChoiceRowBuilder.heading().withSlug("track").withTrack(2))
			.build());
		await ctrl.addGroup("ns-2", new TestChoiceGroupBuilder().withSlug("choices")
			.addChoice(TestChoiceRowBuilder.heading().withSlug("track").withTrack(2))
			.build());

		await ctrl.setCount("ns-1", "track", 1);
		await ctrl.setCount("ns-2", "track", 2);

		expect(ctrl.buildGroupSnapshot("ns-1").list[0].track.checks).toEqual([true, false]);
		expect(ctrl.buildGroupSnapshot("ns-2").list[0].track.checks).toEqual([true, true]);
	});

	it("mixed group types in the same controller have independent values", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("headings", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("my-track").withTrack(1))
			.build());
		await ctrl.addGroup("picks", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.pick().withOptions({ slug: "yes", text: "Yes" }))
			.build());

		await ctrl.setCount("headings", "my-track", 1);
		await ctrl.selectOption("picks", "yes", "yes");

		expect(ctrl.buildGroupSnapshot("headings").list[0].track.checks[0]).toBe(true);
		expect(ctrl.buildGroupSnapshot("picks").list[0].options[0].checked).toBe(true);
	});
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("ChoiceGroupController — validation", () => {
	it("addGroup throws when two rows share the same slug", async () => {
		const ctrl = makeController();
		await expect(ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("dup").withTrack(1))
			.addChoice(TestChoiceRowBuilder.heading().withSlug("dup").withTrack(1))
			.build())
		).rejects.toThrow();
	});
});

// ── clearValues ───────────────────────────────────────────────────────────────

describe("ChoiceGroupController — clearValues", () => {
	it("clearValues(namespace) resets only that namespace", async () => {
		const ctrl = makeController();
		await ctrl.addGroup("ns-a", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("track").withTrack(1))
			.build());
		await ctrl.addGroup("ns-b", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.heading().withSlug("track").withTrack(1))
			.build());

		await ctrl.setCount("ns-a", "track", 1);
		await ctrl.setCount("ns-b", "track", 1);
		await ctrl.clearValues("ns-a");

		expect(ctrl.buildGroupSnapshot("ns-a").list[0].track.checks[0]).toBe(false);
		expect(ctrl.buildGroupSnapshot("ns-b").list[0].track.checks[0]).toBe(true);
	});
});

// ── forItem ───────────────────────────────────────────────────────────────────

describe("ChoiceGroupController.forItem", () => {
	it("buildGroupSnapshot reads the definition from item.system.choices", async () => {
		const { actor, itemId } = makeItemWithChoices([
			{ slug: "ns", list: [{ type: "heading", slug: "my-track", track: { max: 1 }, content: {} }] },
		]);
		actor.items.get(itemId).system.choiceValues = { ns: { "my-track": 1 } };

		const ctrl = ChoiceGroupController.forItem(actor, itemId, "choiceValues");

		expect(ctrl.buildGroupSnapshot("ns").list[0].track.checks[0]).toBe(true);
	});

	it("setCount writes to the item via updateEmbeddedDocuments, not actor.update", async () => {
		const { actor, itemId } = makeItemWithChoices([
			{ slug: "ns", list: [{ type: "heading", slug: "my-track", track: { max: 1 }, content: {} }] },
		]);

		const ctrl = ChoiceGroupController.forItem(actor, itemId, "choiceValues");
		await ctrl.setCount("ns", "my-track", 1);

		expect(actor.updatedDocs.some(d => d._id === itemId)).toBe(true);
		expect(actor.system.choices).toBeUndefined();
	});

	it("setCount value is reflected in subsequent buildGroupSnapshot", async () => {
		const { actor, itemId } = makeItemWithChoices([
			{ slug: "ns", list: [{ type: "heading", slug: "my-track", track: { max: 1 }, content: {} }] },
		]);

		const ctrl = ChoiceGroupController.forItem(actor, itemId, "choiceValues");
		await ctrl.setCount("ns", "my-track", 1);

		expect(ctrl.buildGroupSnapshot("ns").list[0].track.checks[0]).toBe(true);
	});

	it("fires follower effect for follower rows in item.system.choices", async () => {
		const followers = new FakeFollowers();
		const { actor, itemId } = makeItemWithChoices([
			{ slug: "ns", list: [{ type: "follower", slug: "enfys", title: "Enfys", track: { max: 1 } }] },
		]);

		const ctrl = ChoiceGroupController.forItem(actor, itemId, "choiceValues", { followers });
		await ctrl.setCount("ns", "enfys", 1);

		expect(followers.isOwned("enfys")).toBe(true);
	});

	it("removing a follower choice (count 0) removes from followers", async () => {
		const followers = new FakeFollowers();
		const { actor, itemId } = makeItemWithChoices([
			{ slug: "ns", list: [{ type: "follower", slug: "enfys", title: "Enfys", track: { max: 1 } }] },
		]);

		const ctrl = ChoiceGroupController.forItem(actor, itemId, "choiceValues", { followers });
		await ctrl.setCount("ns", "enfys", 1);
		await ctrl.setCount("ns", "enfys", 0);

		expect(followers.isOwned("enfys")).toBe(false);
	});

	it("custom definitionGetter overrides item.system.choices lookup", async () => {
		const followers = new FakeFollowers();
		const { actor, itemId } = makeItemWithChoices([]); // empty system.choices
		const customDef = { slug: "back", list: [{ type: "follower", slug: "rook", title: "Rook", track: { max: 1 } }] };

		const ctrl = ChoiceGroupController.forItem(actor, itemId, "choiceValues", {
			followers,
			definitionGetter: (ns) => customDef.slug === ns ? customDef : null,
		});
		await ctrl.setCount("back", "rook", 1);

		expect(followers.isOwned("rook")).toBe(true);
	});
});

// ── Entry rows with followers field ──────────────────────────────────────────

describe("ChoiceGroupController — entry rows with followers", () => {
	it("setCount(1) on an entry row with followers adds the follower", async () => {
		const followers = new FakeFollowers();
		const ctrl = ChoiceGroupController.forActorSection(makeActor(), "choices", { followers });
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.entry().withSlug("enfys").withFollowers("enfys").withTrack(1))
			.build());

		await ctrl.setCount("ns", "enfys", 1);

		expect(followers.isOwned("enfys")).toBe(true);
	});

	it("setCount(0) on an entry row with followers removes the follower", async () => {
		const followers = new FakeFollowers();
		const ctrl = ChoiceGroupController.forActorSection(makeActor(), "choices", { followers });
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.entry().withSlug("enfys").withFollowers("enfys").withTrack(1))
			.build());

		await ctrl.setCount("ns", "enfys", 1);
		await ctrl.setCount("ns", "enfys", 0);

		expect(followers.isOwned("enfys")).toBe(false);
	});

	it("entry row without followers does not add to followers on setCount", async () => {
		const followers = new FakeFollowers();
		const ctrl = ChoiceGroupController.forActorSection(makeActor(), "choices", { followers });
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.entry().withSlug("lore-track").withTrack(1))
			.build());

		await ctrl.setCount("ns", "lore-track", 1);

		expect(followers.owned).toHaveLength(0);
	});

	it("entry row with multiple followers adds all of them", async () => {
		const followers = new FakeFollowers();
		const ctrl = ChoiceGroupController.forActorSection(makeActor(), "choices", { followers });
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.entry().withSlug("dual").withFollowers("enfys", "rook").withTrack(1))
			.build());

		await ctrl.setCount("ns", "dual", 1);

		expect(followers.isOwned("enfys")).toBe(true);
		expect(followers.isOwned("rook")).toBe(true);
	});
});

// ── Pick options with followers ───────────────────────────────────────────────

describe("ChoiceGroupController — pick options with followers", () => {
	it("selectOption fires addFollower for the chosen option's followers", async () => {
		const followers = new FakeFollowers();
		const ctrl = ChoiceGroupController.forActorSection(makeActor(), "choices", { followers });
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.pick().withOptions(
				{ slug: "enfys-pick", text: "Enfys", followers: ["enfys"] },
				{ slug: "rook-pick",  text: "Rook" },
			))
			.build());

		await ctrl.selectOption("ns", "enfys-pick", "enfys-pick,rook-pick");

		expect(followers.isOwned("enfys")).toBe(true);
	});

	it("selecting a different option fires removeFollower for the previously selected one", async () => {
		const followers = new FakeFollowers();
		const ctrl = ChoiceGroupController.forActorSection(makeActor(), "choices", { followers });
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.pick().withOptions(
				{ slug: "enfys-pick", text: "Enfys", followers: ["enfys"] },
				{ slug: "rook-pick",  text: "Rook",  followers: ["rook"]  },
			))
			.build());

		await ctrl.selectOption("ns", "enfys-pick", "enfys-pick,rook-pick");
		await ctrl.selectOption("ns", "rook-pick",  "enfys-pick,rook-pick");

		expect(followers.isOwned("enfys")).toBe(false);
		expect(followers.isOwned("rook")).toBe(true);
	});

	it("sibling without followers does not cause errors when deselected", async () => {
		const followers = new FakeFollowers();
		const ctrl = ChoiceGroupController.forActorSection(makeActor(), "choices", { followers });
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.pick().withOptions(
				{ slug: "with-follower",    text: "A", followers: ["enfys"] },
				{ slug: "without-follower", text: "B" },
			))
			.build());

		await ctrl.selectOption("ns", "with-follower",    "with-follower,without-follower");
		await ctrl.selectOption("ns", "without-follower", "with-follower,without-follower");

		expect(followers.isOwned("enfys")).toBe(false);
	});
});

// ── outfitItems — per-option sources ─────────────────────────────────────────

describe("ChoiceGroupController — outfitItems per-option sources", () => {
	const SWORD = { slug: "sword", name: "Sword", weight: 1 };
	const BOW   = { slug: "bow",   name: "Bow",   weight: 1 };

	function makeControllerWithOutfit(sourcePrefix = "cg") {
		const fakeItems = new FakeOutfitItems();
		const ctrl = ChoiceGroupController.forActorSection(makeActor(), "choices", {
			outfitItems: { items: fakeItems, sourcePrefix },
		});
		return { ctrl, fakeItems };
	}

	it("selecting a pick option with outfitItems syncs to sourcePrefix:namespace:optionSlug", async () => {
		const { ctrl, fakeItems } = makeControllerWithOutfit();
		await ctrl.addGroup("weapons", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.pick().withOptions(
				{ slug: "sword-opt", text: "Sword", outfitItems: [SWORD] },
				{ slug: "bow-opt",   text: "Bow" },
			))
			.build());

		await ctrl.selectOption("weapons", "sword-opt", "sword-opt,bow-opt");

		expect(fakeItems.getItems("cg:weapons:sword-opt")).toEqual([SWORD]);
	});

	it("selecting a different option removes the previous option's outfit items", async () => {
		const { ctrl, fakeItems } = makeControllerWithOutfit();
		await ctrl.addGroup("weapons", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.pick().withOptions(
				{ slug: "sword-opt", text: "Sword", outfitItems: [SWORD] },
				{ slug: "bow-opt",   text: "Bow",   outfitItems: [BOW]   },
			))
			.build());

		await ctrl.selectOption("weapons", "sword-opt", "sword-opt,bow-opt");
		await ctrl.selectOption("weapons", "bow-opt",   "sword-opt,bow-opt");

		expect(fakeItems.hasSource("cg:weapons:sword-opt")).toBe(false);
		expect(fakeItems.getItems("cg:weapons:bow-opt")).toEqual([BOW]);
	});

	it("setCount(0) on an entry row with outfitItems removes that source", async () => {
		const { ctrl, fakeItems } = makeControllerWithOutfit();
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.entry().withSlug("kit").withTrack(1).withOutfitItems([SWORD]))
			.build());

		await ctrl.setCount("ns", "kit", 1);
		await ctrl.setCount("ns", "kit", 0);

		expect(fakeItems.hasSource("cg:ns:kit")).toBe(false);
	});

	it("uses the configured sourcePrefix in the source key", async () => {
		const { ctrl, fakeItems } = makeControllerWithOutfit("possessions");
		await ctrl.addGroup("ns", new TestChoiceGroupBuilder()
			.addChoice(TestChoiceRowBuilder.entry().withSlug("kit").withTrack(1).withOutfitItems([SWORD]))
			.build());

		await ctrl.setCount("ns", "kit", 1);

		expect(fakeItems.hasSource("possessions:ns:kit")).toBe(true);
	});
});
