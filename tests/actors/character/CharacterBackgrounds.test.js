import { describe, it, expect, vi } from "vitest";
import { CharacterBackgrounds } from "../../../module/actors/character/CharacterBackgrounds.js";
import { BackgroundSection } from "../../../module/model/snapshot/character/CharacterSnapshot.js";
import { ChoiceGroup } from "../../../module/model/snapshot/character/ChoiceGroup.js";

function makeFlags(store = {}) {
	return {
		_store: { ...store },
		getFlag: (key) => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

function makeFollowers() {
	return {
		addFollower:    vi.fn(async () => {}),
		removeFollower: vi.fn(async () => {}),
	};
}

function makeBg(selectedSlug = "", choicesRaw = {}, followers = null) {
	return new CharacterBackgrounds(makeFlags({ selected: selectedSlug, choices: choicesRaw }), followers);
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
			{ type: "follower", slug: "enfys", inlineDisplay: false, title: "Enfys, your acolyte", track: { max: 1 } },
			{ type: "follower", slug: "afon",  inlineDisplay: false, title: "Afon, Fae-touched",   track: { max: 1 } },
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

// -- Tests: selectedSlug / selectBackground -----------------------------------

describe("CharacterBackgrounds", () => {
	it("selectedSlug returns empty string when no saved selection", () => {
		expect(new CharacterBackgrounds(makeFlags()).selectedSlug).toBe("");
	});

	it("selectedSlug returns the stored slug", () => {
		expect(new CharacterBackgrounds(makeFlags({ selected: "vessel" })).selectedSlug).toBe("vessel");
	});

	it("selectBackground stores the slug via setFlag", async () => {
		const flags = makeFlags();
		const bg = new CharacterBackgrounds(flags);
		await bg.selectBackground("initiate");
		expect(flags.setFlag).toHaveBeenCalledWith("selected", "initiate");
	});
});

// -- Tests: setChoiceValue ---------------------------------------------------

describe("CharacterBackgrounds.setChoiceValue", () => {
	it("saves the count to flags.choices in ChoiceValues format", async () => {
		const store = {};
		const bg = new CharacterBackgrounds(makeFlags(store));
		await bg.setChoiceValue("initiate", "enfys", 1);
		expect(store.choices).toEqual({ initiate: { enfys: 1 } });
	});

	it("merges into existing choices state", async () => {
		const store = { choices: { initiate: { afon: 1 } } };
		const bg = new CharacterBackgrounds(makeFlags(store));
		await bg.setChoiceValue("initiate", "enfys", 1);
		expect(store.choices.initiate).toEqual({ afon: 1, enfys: 1 });
	});

	it("does not call addFollower even when followers is provided", async () => {
		const followers = makeFollowers();
		const bg = new CharacterBackgrounds(makeFlags({}), followers);
		await bg.setChoiceValue("driven", "enfys", 1);
		expect(followers.addFollower).not.toHaveBeenCalled();
	});
});

// -- Tests: setFollowerChoiceValue -------------------------------------------

describe("CharacterBackgrounds.setFollowerChoiceValue", () => {
	it("saves the count to flags.choices", async () => {
		const store = {};
		const bg = new CharacterBackgrounds(makeFlags(store), makeFollowers());
		await bg.setFollowerChoiceValue("initiate", "enfys", 1);
		expect(store.choices).toEqual({ initiate: { enfys: 1 } });
	});

	it("calls addFollower when count > 0", async () => {
		const followers = makeFollowers();
		const bg = new CharacterBackgrounds(makeFlags({}), followers);
		await bg.setFollowerChoiceValue("initiate", "enfys", 1);
		expect(followers.addFollower).toHaveBeenCalledWith("enfys");
	});

	it("calls removeFollower when count === 0", async () => {
		const followers = makeFollowers();
		const bg = new CharacterBackgrounds(makeFlags({}), followers);
		await bg.setFollowerChoiceValue("initiate", "enfys", 0);
		expect(followers.removeFollower).toHaveBeenCalledWith("enfys");
	});

	it("does not throw when followers is null", async () => {
		const bg = new CharacterBackgrounds(makeFlags({}), null);
		await expect(bg.setFollowerChoiceValue("initiate", "enfys", 1)).resolves.not.toThrow();
	});
});

// -- Tests: buildSnapshot ----------------------------------------------------

describe("CharacterBackgrounds.buildSnapshot", () => {
	it("returns a BackgroundSection", () => {
		expect(makeBg().buildSnapshot(SIMPLE_BG_DATA)).toBeInstanceOf(BackgroundSection);
	});

	it("includes one option per background", () => {
		expect(makeBg().buildSnapshot(SIMPLE_BG_DATA).options).toHaveLength(2);
	});

	it("option has slug, label, and description", () => {
		const snap = makeBg().buildSnapshot(SIMPLE_BG_DATA);
		expect(snap.options[0].slug).toBe("initiate");
		expect(snap.options[0].label).toBe("Initiate");
		expect(snap.options[0].description).toBe("<p>Initiate.</p>");
	});

	it("option matching selectedSlug is marked selected", () => {
		const snap = makeBg("vessel").buildSnapshot(SIMPLE_BG_DATA);
		expect(snap.options[0].selected).toBe(false);
		expect(snap.options[1].selected).toBe(true);
	});

	it("no option is selected when nothing saved", () => {
		expect(makeBg("").buildSnapshot(SIMPLE_BG_DATA).options.every(o => !o.selected)).toBe(true);
	});

	it("selected is the saved slug", () => {
		expect(makeBg("initiate").buildSnapshot(SIMPLE_BG_DATA).selected).toBe("initiate");
	});

	it("selected is null when nothing saved", () => {
		expect(makeBg("").buildSnapshot(SIMPLE_BG_DATA).selected).toBeNull();
	});

	it("converts move names to slugs", () => {
		const snap = makeBg().buildSnapshot(SIMPLE_BG_DATA);
		expect(snap.options[0].moves).toEqual(["rites-of-the-land"]);
		expect(snap.options[1].moves).toEqual(["danus-grasp"]);
	});

	it("choices is null when background has no choices", () => {
		expect(makeBg().buildSnapshot(SIMPLE_BG_DATA).options[0].choices).toBeNull();
	});

	it("builds a ChoiceGroup when background has follower choices", () => {
		const snap = makeBg().buildSnapshot(FOLLOWER_CHOICES_DATA);
		expect(snap.options[0].choices).toBeInstanceOf(ChoiceGroup);
	});

	it("builds a ChoiceGroup when background has heading choices", () => {
		const snap = makeBg().buildSnapshot(HEADING_CHOICES_DATA);
		expect(snap.options[0].choices).toBeInstanceOf(ChoiceGroup);
	});

	it("ChoiceGroup list has correct length", () => {
		const snap = makeBg().buildSnapshot(FOLLOWER_CHOICES_DATA);
		expect(snap.options[0].choices.list).toHaveLength(2);
	});

	it("saved follower choice reflects checked track state", () => {
		const snap = makeBg("", { initiate: { enfys: 1 } }).buildSnapshot(FOLLOWER_CHOICES_DATA);
		const row = snap.options[0].choices.list.find(r => r.slug === "enfys");
		expect(row.track.checks[0]).toBe(true);
	});

	it("unsaved follower choice has unchecked track", () => {
		const snap = makeBg().buildSnapshot(FOLLOWER_CHOICES_DATA);
		const row = snap.options[0].choices.list.find(r => r.slug === "afon");
		expect(row.track.checks[0]).toBe(false);
	});

	it("returns empty options when backgroundsData is absent", () => {
		expect(makeBg().buildSnapshot(undefined).options).toHaveLength(0);
	});
});
