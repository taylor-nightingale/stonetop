import { describe, it, expect } from "vitest";
import { CharacterBackgrounds } from "../../../src/actors/character/CharacterBackgrounds.js";
import { ChoiceGroupFactory } from "../../../src/actors/character/ChoiceGroupFactory.js";
import { FollowerSideEffectHandler } from "../../../src/actors/character/SideEffectHandler.js";
import { ResourceController } from "../../../src/actors/character/ResourceController.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { FakeFollowers } from "../../fakes/FakeFollowers.js";
import { BackgroundSection } from "../../../src/model/snapshot/character/CharacterSnapshot.js";
import { ChoiceGroup } from "../../../src/model/snapshot/character/ChoiceGroup.js";

function makeResourceController() {
	return new ResourceController(new FakeActorBuilder().build());
}

function makePbItem(backgroundValues = {}, backgrounds = []) {
	return { _id: "pb-1", type: "playbook", name: "The Blessed", system: { backgrounds, backgroundValues } };
}

function makeBg(selectedSlug = "", backgroundValues = {}, followers = null, resourceCtrl = null, pbBackgrounds = []) {
	const actor = new FakeActorBuilder().withItems([makePbItem(backgroundValues, pbBackgrounds)]).build();
	actor.system.background = { selected: selectedSlug };
	const factory = new ChoiceGroupFactory(actor);
	if (followers) factory.register(new FollowerSideEffectHandler(followers));
	return new CharacterBackgrounds(actor, factory, resourceCtrl ?? makeResourceController());
}

const SIMPLE_BG_DATA = [
	{ slug: "initiate", label: "Initiate", description: "<p>Initiate.</p>", moves: ["Rites of the Land"] },
	{ slug: "vessel",   label: "Vessel",   description: "<p>Vessel.</p>",   moves: ["Danu's Grasp"] },
];

const FOLLOWER_CHOICES_DATA = [{
	slug: "initiate", label: "Initiate", description: "<p>Initiate. Pick 2 or 3:</p>", moves: [],
	choices: {
		slug: "initiate",
		list: [
			{ type: "entry", slug: "enfys", followers: ["enfys"], inlineDisplay: false, content: { text: "Enfys, your acolyte" }, track: { max: 1 } },
			{ type: "entry", slug: "afon",  followers: ["afon"],  inlineDisplay: false, content: { text: "Afon, Fae-touched"   }, track: { max: 1 } },
		],
	},
}];

const HEADING_CHOICES_DATA = [{
	slug: "driven", label: "Driven", description: "<p>Driven. Pick 2 or 3:</p>", moves: [],
	choices: {
		slug: "driven",
		list: [
			{ type: "heading", slug: "enfys", description: "Enfys, your acolyte", track: { max: 1 } },
			{ type: "heading", slug: "afon",  description: "Afon, Fae-touched",   track: { max: 1 } },
		],
	},
}];

// -- selectedSlug / selectBackground ------------------------------------------

describe("CharacterBackgrounds", () => {
	it("selectedSlug returns empty string when no saved selection", () => {
		expect(makeBg().selectedSlug).toBe("");
	});

	it("selectedSlug returns the stored slug", () => {
		expect(makeBg("vessel").selectedSlug).toBe("vessel");
	});

	it("selectBackground stores the slug", async () => {
		const bg = makeBg();
		await bg.selectBackground("initiate");
		expect(bg.selectedSlug).toBe("initiate");
	});
});

// -- setChoiceValue -----------------------------------------------------------

describe("CharacterBackgrounds.setChoiceValue", () => {
	it("saves the count so it reflects in the snapshot choices", async () => {
		const bg = makeBg("", {}, null, null, FOLLOWER_CHOICES_DATA);
		await bg.setChoiceValue("initiate", "enfys", 1);
		const snap = await bg.buildSnapshot(FOLLOWER_CHOICES_DATA);
		const row  = snap.options[0].choices.list.find(r => r.slug === "enfys");
		expect(row.track.checks[0]).toBe(true);
	});

	it("adds the follower when setChoiceValue is called on a follower-type row", async () => {
		const followers = new FakeFollowers();
		const bg = makeBg("", {}, followers, null, FOLLOWER_CHOICES_DATA);
		await bg.setChoiceValue("initiate", "enfys", 1);
		expect(followers.isOwned("enfys")).toBe(true);
	});

	it("removes the follower when count is set to 0 on a follower-type row", async () => {
		const followers = new FakeFollowers();
		const bg = makeBg("", {}, followers, null, FOLLOWER_CHOICES_DATA);
		await bg.setChoiceValue("initiate", "enfys", 1);
		await bg.setChoiceValue("initiate", "enfys", 0);
		expect(followers.isOwned("enfys")).toBe(false);
	});

	it("does not add to followers for non-follower (heading) rows", async () => {
		const followers = new FakeFollowers();
		const bg = makeBg("", {}, followers);
		await bg.setChoiceValue("driven", "enfys", 1);
		expect(followers.isOwned("enfys")).toBe(false);
	});
});

// -- buildSnapshot ------------------------------------------------------------

describe("CharacterBackgrounds.buildSnapshot", () => {
	it("returns a BackgroundSection", async () => {
		expect(await makeBg().buildSnapshot(SIMPLE_BG_DATA)).toBeInstanceOf(BackgroundSection);
	});

	it("includes one option per background", async () => {
		expect((await makeBg().buildSnapshot(SIMPLE_BG_DATA)).options).toHaveLength(2);
	});

	it("option has slug, label, and description", async () => {
		const snap = await makeBg().buildSnapshot(SIMPLE_BG_DATA);
		expect(snap.options[0].slug).toBe("initiate");
		expect(snap.options[0].label).toBe("Initiate");
		expect(snap.options[0].description).toBe("<p>Initiate.</p>");
	});

	it("option matching selectedSlug is marked selected", async () => {
		const snap = await makeBg("vessel").buildSnapshot(SIMPLE_BG_DATA);
		expect(snap.options[0].selected).toBe(false);
		expect(snap.options[1].selected).toBe(true);
	});

	it("no option is selected when nothing saved", async () => {
		expect((await makeBg().buildSnapshot(SIMPLE_BG_DATA)).options.every(o => !o.selected)).toBe(true);
	});

	it("selected is the saved slug", async () => {
		expect((await makeBg("initiate").buildSnapshot(SIMPLE_BG_DATA)).selected).toBe("initiate");
	});

	it("selected is null when nothing saved", async () => {
		expect((await makeBg("").buildSnapshot(SIMPLE_BG_DATA)).selected).toBeNull();
	});

	it("converts move names to slugs", async () => {
		const snap = await makeBg().buildSnapshot(SIMPLE_BG_DATA);
		expect(snap.options[0].moves).toEqual(["rites-of-the-land"]);
		expect(snap.options[1].moves).toEqual(["danus-grasp"]);
	});

	it("choices is null when background has no choices", async () => {
		expect((await makeBg().buildSnapshot(SIMPLE_BG_DATA)).options[0].choices).toBeNull();
	});

	it("builds a ChoiceGroup when background has follower choices", async () => {
		const snap = await makeBg().buildSnapshot(FOLLOWER_CHOICES_DATA);
		expect(snap.options[0].choices).toBeInstanceOf(ChoiceGroup);
	});

	it("builds a ChoiceGroup when background has heading choices", async () => {
		const snap = await makeBg().buildSnapshot(HEADING_CHOICES_DATA);
		expect(snap.options[0].choices).toBeInstanceOf(ChoiceGroup);
	});

	it("ChoiceGroup list has correct length", async () => {
		const snap = await makeBg().buildSnapshot(FOLLOWER_CHOICES_DATA);
		expect(snap.options[0].choices.list).toHaveLength(2);
	});

	it("saved follower choice reflects checked track state", async () => {
		const snap = await makeBg("", { initiate: { enfys: 1 } }).buildSnapshot(FOLLOWER_CHOICES_DATA);
		const row  = snap.options[0].choices.list.find(r => r.slug === "enfys");
		expect(row.track.checks[0]).toBe(true);
	});

	it("unsaved follower choice has unchecked track", async () => {
		const snap = await makeBg().buildSnapshot(FOLLOWER_CHOICES_DATA);
		const row  = snap.options[0].choices.list.find(r => r.slug === "afon");
		expect(row.track.checks[0]).toBe(false);
	});

	it("returns empty options when backgroundsData is absent", async () => {
		expect((await makeBg().buildSnapshot(undefined)).options).toHaveLength(0);
	});

	it("resource is null when background has no resource field", async () => {
		expect((await makeBg().buildSnapshot(SIMPLE_BG_DATA)).options[0].resource).toBeNull();
	});

	it("resource is a ResourceSnapshot when background has a resource field", async () => {
		const data = [{ slug: "initiate", label: "Initiate", description: "", resource: { max: 2, title: "Uses", labels: [] } }];
		expect(await makeBg().buildSnapshot(data)).toMatchObject({
			options: [{ resource: { max: 2, current: 0, title: "Uses" } }],
		});
	});

	it("resource.current reflects saved value", async () => {
		const data = [{ slug: "initiate", label: "Initiate", description: "", resource: { max: 2, title: null, labels: [] } }];
		const resourceCtrl = makeResourceController();
		await resourceCtrl.set("backgrounds", "initiate", 1);
		const snap = await makeBg("", {}, null, resourceCtrl).buildSnapshot(data);
		expect(snap.options[0].resource.current).toBe(1);
	});
});

// -- setResource --------------------------------------------------------------

describe("CharacterBackgrounds.setResource", () => {
	it("persists count in the backgrounds namespace of ResourceController", async () => {
		const resourceCtrl = makeResourceController();
		await makeBg("", {}, null, resourceCtrl).setResource("initiate", 2);
		expect(resourceCtrl.getCurrent("backgrounds", "initiate")).toBe(2);
	});

	it("merges into existing resources", async () => {
		const resourceCtrl = makeResourceController();
		await resourceCtrl.set("backgrounds", "vessel", 1);
		await makeBg("", {}, null, resourceCtrl).setResource("initiate", 2);
		expect(resourceCtrl.getCurrent("backgrounds", "initiate")).toBe(2);
		expect(resourceCtrl.getCurrent("backgrounds", "vessel")).toBe(1);
	});
});
