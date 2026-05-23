import { describe, it, expect, vi } from "vitest";
import { CharacterBackgrounds } from "../../../module/actors/character/CharacterBackgrounds.js";
import { BackgroundSection } from "../../../module/model/snapshot/character/CharacterSnapshot.js";

function makeFlags(store = {}) {
	return {
		_store: { ...store },
		getFlag: (key) => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

function makeBg(selected = "", choices = {}) {
	return new CharacterBackgrounds(makeFlags({ selected, choices }));
}

const SIMPLE_BG_DATA = [
	{ slug: "initiate", label: "Initiate", description: "<p>Initiate.</p>", moves: ["Rites of the Land"] },
	{ slug: "vessel",   label: "Vessel",   description: "<p>Vessel.</p>",   moves: ["Danu's Grasp"] },
];

const BG_WITH_CHOICES = [{
	slug: "initiate", label: "Initiate", description: "", moves: [],
	choices: {
		label: "Who are they?",
		count: [2, 3],
		options: [
			{ slug: "enfys", label: "Enfys" },
			{ slug: "afon",  label: "Afon" },
		],
	},
}];

describe("CharacterBackgrounds", () => {
	it("selectedSlug returns empty string when no saved selection", () => {
		const bg = new CharacterBackgrounds(makeFlags());
		expect(bg.selectedSlug).toBe("");
	});

	it("selectedSlug returns the stored slug", () => {
		const bg = new CharacterBackgrounds(makeFlags({ selected: "vessel" }));
		expect(bg.selectedSlug).toBe("vessel");
	});

	it("selectBackground stores the slug via setFlag", async () => {
		const flags = makeFlags();
		const bg = new CharacterBackgrounds(flags);
		await bg.selectBackground("initiate");
		expect(flags.setFlag).toHaveBeenCalledWith("selected", "initiate");
	});

	it("choices returns empty object when no choices saved", () => {
		const bg = new CharacterBackgrounds(makeFlags());
		expect(bg.choices).toEqual({});
	});

	it("choices returns saved choices object", () => {
		const bg = new CharacterBackgrounds(makeFlags({ choices: { "hard-upbringing": true } }));
		expect(bg.choices).toEqual({ "hard-upbringing": true });
	});

	it("addChoice merges checked state into saved choices", async () => {
		const store = { choices: { "old-slug": false } };
		const flags = makeFlags(store);
		const bg = new CharacterBackgrounds(flags);
		const choice = { slug: "new-slug", isChecked: true };
		await bg.addChoice(choice);
		expect(flags.setFlag).toHaveBeenCalledWith("choices", { "old-slug": false, "new-slug": true });
	});

	it("addChoice works when no choices previously saved", async () => {
		const flags = makeFlags();
		const bg = new CharacterBackgrounds(flags);
		const choice = { slug: "hard-upbringing", isChecked: false };
		await bg.addChoice(choice);
		expect(flags.setFlag).toHaveBeenCalledWith("choices", { "hard-upbringing": false });
	});
});

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

	it("builds choices when background has choices data", () => {
		const snap = makeBg().buildSnapshot(BG_WITH_CHOICES);
		expect(snap.options[0].choices).not.toBeNull();
		expect(snap.options[0].choices.label).toBe("Who are they?");
		expect(snap.options[0].choices.options).toHaveLength(2);
	});

	it("choice options reflect saved checked state", () => {
		const snap = makeBg("", { enfys: true }).buildSnapshot(BG_WITH_CHOICES);
		expect(snap.options[0].choices.options.find(o => o.slug === "enfys").checked).toBe(true);
		expect(snap.options[0].choices.options.find(o => o.slug === "afon").checked).toBe(false);
	});

	it("returns empty options when backgroundsData is absent", () => {
		expect(makeBg().buildSnapshot(undefined).options).toHaveLength(0);
	});
});
