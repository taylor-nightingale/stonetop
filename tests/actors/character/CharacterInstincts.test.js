import { describe, it, expect, vi } from "vitest";
import { CharacterInstincts } from "../../../module/actors/character/CharacterInstincts.js";
import { ChoiceGroup } from "../../../module/model/snapshot/character/ChoiceGroup.js";

function makeFlags(store = {}) {
	return {
		getFlag: key => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

function makeInstinct(store = {}) {
	return new CharacterInstincts(makeFlags(store));
}

const INSTINCT_DATA = {
	slug: "instinct",
	list: [{
		type: "pick",
		pickCount: 1,
		options: [
			{ slug: "delight",    text: "Delight",    description: "To find beauty, in even the ugliest things." },
			{ slug: "detachment", text: "Detachment", description: "To remain unmoved, to be cold as winter." },
		],
	}],
};

// -- selectOption -------------------------------------------------------------

describe("CharacterInstincts — selectOption", () => {
	it("stores chosen slug in values under the instinct group", async () => {
		const store = {};
		const inst = new CharacterInstincts(makeFlags(store));
		await inst.selectOption("delight", "delight,detachment");
		expect(store.values.instinct.delight).toBe(1);
	});

	it("zeroes sibling slugs when selecting an option", async () => {
		const store = {};
		const inst = new CharacterInstincts(makeFlags(store));
		await inst.selectOption("delight", "delight,detachment");
		expect(store.values.instinct.detachment).toBe(0);
	});

	it("clears custom text when an option is selected", async () => {
		const store = { custom: "my bespoke instinct" };
		const inst = new CharacterInstincts(makeFlags(store));
		await inst.selectOption("delight", "delight,detachment");
		expect(store.custom).toBe("");
	});
});

// -- selectCustom -------------------------------------------------------------

describe("CharacterInstincts — selectCustom", () => {
	it("stores custom text in the custom flag", async () => {
		const store = {};
		const inst = new CharacterInstincts(makeFlags(store));
		await inst.selectCustom("to nurture at all costs");
		expect(store.custom).toBe("to nurture at all costs");
	});

	it("clears all ChoiceValues when custom text is entered", async () => {
		const store = { values: { instinct: { delight: 1 } } };
		const inst = new CharacterInstincts(makeFlags(store));
		await inst.selectCustom("my custom instinct");
		expect(store.values).toEqual({});
	});
});

// -- buildSnapshot ------------------------------------------------------------

describe("CharacterInstincts.buildSnapshot", () => {
	it("returns an object with group (ChoiceGroup) and selected", () => {
		const snap = makeInstinct().buildSnapshot(INSTINCT_DATA);
		expect(snap.group).toBeInstanceOf(ChoiceGroup);
		expect("selected" in snap).toBe(true);
	});

	it("group contains the options from pack data", () => {
		const snap = makeInstinct().buildSnapshot(INSTINCT_DATA);
		const opts = snap.group.list[0].options;
		expect(opts).toHaveLength(2);
		expect(opts[0].slug).toBe("delight");
		expect(opts[0].text).toBe("Delight");
		expect(opts[0].description).toBe("To find beauty, in even the ugliest things.");
	});

	it("selected is null when nothing is saved", () => {
		expect(makeInstinct().buildSnapshot(INSTINCT_DATA).selected).toBeNull();
	});

	it("saved slug marks the matching option as checked", () => {
		const store = { values: { instinct: { delight: 1 } } };
		const snap = makeInstinct(store).buildSnapshot(INSTINCT_DATA);
		const opts = snap.group.list[0].options;
		expect(opts.find(o => o.slug === "delight").checked).toBe(true);
		expect(opts.find(o => o.slug === "detachment").checked).toBe(false);
	});

	it("selected is the composite label — description of the checked option", () => {
		const store = { values: { instinct: { delight: 1 } } };
		const snap = makeInstinct(store).buildSnapshot(INSTINCT_DATA);
		expect(snap.selected).toBe("Delight — To find beauty, in even the ugliest things.");
	});

	it("selected is the custom text when no ChoiceValues selection", () => {
		const store = { custom: "my bespoke instinct" };
		const snap = makeInstinct(store).buildSnapshot(INSTINCT_DATA);
		expect(snap.selected).toBe("my bespoke instinct");
	});

	it("returns group null and selected null when instinctData is absent", () => {
		const snap = makeInstinct().buildSnapshot(null);
		expect(snap.group).toBeNull();
		expect(snap.selected).toBeNull();
	});
});
