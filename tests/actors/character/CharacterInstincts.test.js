import { describe, it, expect } from "vitest";
import { CharacterInstincts } from "../../../src/actors/character/CharacterInstincts.js";
import { ChoiceGroupController } from "../../../src/actors/character/ChoiceGroupController.js";
import { StonetopFlags } from "../../../src/actors/character/StonetopFlags.js";
import { FakeFlags } from "../../fakes/foundry/FakeFlags.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { ChoiceGroup } from "../../../src/model/snapshot/character/ChoiceGroup.js";

function makeInstinct(valuesRaw = {}, initialCustom = "") {
	const actor = new FakeActorBuilder().build();
	actor.system.instinct = { custom: initialCustom };
	const fakeFlags = new FakeFlags();
	if (Object.keys(valuesRaw).length) fakeFlags.setFlagNonAsync("stonetop", "choices.values", valuesRaw);
	const ctrl = new ChoiceGroupController(new StonetopFlags(fakeFlags, "choices"));
	return new CharacterInstincts(actor, ctrl);
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
		const inst = makeInstinct();
		await inst.selectOption("delight", "delight,detachment");
		const snap = await inst.buildSnapshot(INSTINCT_DATA);
		const opts = snap.group.list[0].options;
		expect(opts.find(o => o.slug === "delight").checked).toBe(true);
	});

	it("zeroes sibling slugs when selecting an option", async () => {
		const inst = makeInstinct();
		await inst.selectOption("delight", "delight,detachment");
		const snap = await inst.buildSnapshot(INSTINCT_DATA);
		const opts = snap.group.list[0].options;
		expect(opts.find(o => o.slug === "detachment").checked).toBe(false);
	});

	it("clears custom text when an option is selected", async () => {
		const inst = makeInstinct({}, "my bespoke instinct");
		await inst.selectOption("delight", "delight,detachment");
		expect(inst._custom).toBe("");
	});
});

// -- selectCustom -------------------------------------------------------------

describe("CharacterInstincts — selectCustom", () => {
	it("stores custom text", async () => {
		const inst = makeInstinct();
		await inst.selectCustom("to nurture at all costs");
		expect(inst._custom).toBe("to nurture at all costs");
	});

	it("clears all ChoiceValues when custom text is entered", async () => {
		const inst = makeInstinct({ instinct: { delight: 1 } });
		await inst.selectCustom("my custom instinct");
		const snap = await inst.buildSnapshot(INSTINCT_DATA);
		expect(snap.group.list[0].options.every(o => !o.checked)).toBe(true);
	});
});

// -- buildSnapshot ------------------------------------------------------------

describe("CharacterInstincts.buildSnapshot", () => {
	it("returns an object with group (ChoiceGroup) and selected", async () => {
		const snap = await makeInstinct().buildSnapshot(INSTINCT_DATA);
		expect(snap.group).toBeInstanceOf(ChoiceGroup);
		expect("selected" in snap).toBe(true);
	});

	it("group contains the options from pack data", async () => {
		const snap = await makeInstinct().buildSnapshot(INSTINCT_DATA);
		const opts = snap.group.list[0].options;
		expect(opts).toHaveLength(2);
		expect(opts[0].slug).toBe("delight");
		expect(opts[0].text).toBe("Delight");
		expect(opts[0].description).toBe("To find beauty, in even the ugliest things.");
	});

	it("selected is null when nothing is saved", async () => {
		expect((await makeInstinct().buildSnapshot(INSTINCT_DATA)).selected).toBeNull();
	});

	it("saved slug marks the matching option as checked", async () => {
		const inst = makeInstinct({ instinct: { delight: 1 } });
		const snap = await inst.buildSnapshot(INSTINCT_DATA);
		const opts = snap.group.list[0].options;
		expect(opts.find(o => o.slug === "delight").checked).toBe(true);
		expect(opts.find(o => o.slug === "detachment").checked).toBe(false);
	});

	it("selected is the composite label — description of the checked option", async () => {
		const inst = makeInstinct({ instinct: { delight: 1 } });
		const snap = await inst.buildSnapshot(INSTINCT_DATA);
		expect(snap.selected).toBe("Delight — To find beauty, in even the ugliest things.");
	});

	it("selected is the custom text when no ChoiceValues selection", async () => {
		const inst = makeInstinct({}, "my bespoke instinct");
		const snap = await inst.buildSnapshot(INSTINCT_DATA);
		expect(snap.selected).toBe("my bespoke instinct");
	});

	it("returns group null and selected null when instinctData is absent", async () => {
		const snap = await makeInstinct().buildSnapshot(null);
		expect(snap.group).toBeNull();
		expect(snap.selected).toBeNull();
	});
});
