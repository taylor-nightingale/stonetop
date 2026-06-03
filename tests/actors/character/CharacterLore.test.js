import { describe, it, expect } from "vitest";
import { CharacterLore } from "../../../src/actors/character/CharacterLore.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { ChoiceValues, ChoiceGroup, HeadingRow } from "../../../src/model/snapshot/character/ChoiceGroup.js";

function makeLore(values = {}) {
	const actor = new FakeActorBuilder().build();
	actor.system.lore = { values };
	return new CharacterLore(actor);
}

const LORE_DATA = [
	{
		slug: "earth",
		list: [
			{ type: "heading", content: { title: "The Earth", text: "<p>The earth knows.</p>" } },
			{ type: "heading", slug: "opt-a", content: { text: "Option A" }, track: { max: 1 } },
			{ type: "heading", slug: "opt-b", content: { text: "Option B" }, track: { max: 3 } },
			{ type: "heading", slug: "opt-text", content: { text: "A text question" }, input: {} },
			{ type: "heading", content: { text: "<p>A heading with no max</p>" } },
		],
	},
];

// -- ChoiceValues -------------------------------------------------------------

describe("ChoiceValues", () => {
	it("getCount returns 0 when no value stored", () => {
		expect(new ChoiceValues().getCount("earth", "opt-a")).toBe(0);
	});

	it("getCount returns stored number", () => {
		expect(new ChoiceValues({ earth: { "opt-a": 2 } }).getCount("earth", "opt-a")).toBe(2);
	});

	it("getText returns empty string when no value stored", () => {
		expect(new ChoiceValues().getText("earth", "opt-text")).toBe("");
	});

	it("getText returns stored string", () => {
		expect(new ChoiceValues({ earth: { "opt-text": "answer" } }).getText("earth", "opt-text")).toBe("answer");
	});

	it("set returns a new ChoiceValues with the value nested by group then slug", () => {
		const result = new ChoiceValues().set("earth", "opt-a", 1);
		expect(result).toBeInstanceOf(ChoiceValues);
		expect(result.getCount("earth", "opt-a")).toBe(1);
	});

	it("set merges new slug into existing group", () => {
		const result = new ChoiceValues({ earth: { "opt-a": 1 } }).set("earth", "opt-b", 2);
		expect(result.getCount("earth", "opt-a")).toBe(1);
		expect(result.getCount("earth", "opt-b")).toBe(2);
	});

	it("set merges new group alongside existing group", () => {
		const result = new ChoiceValues({ earth: { "opt-a": 1 } }).set("sky", "opt-c", 3);
		expect(result.getCount("earth", "opt-a")).toBe(1);
		expect(result.getCount("sky", "opt-c")).toBe(3);
	});

	it("set overwrites an existing value", () => {
		const result = new ChoiceValues({ earth: { "opt-a": 1 } }).set("earth", "opt-a", 0);
		expect(result.getCount("earth", "opt-a")).toBe(0);
	});

	it("set does not mutate the original", () => {
		const original = new ChoiceValues({ earth: { "opt-a": 1 } });
		original.set("earth", "opt-a", 99);
		expect(original.getCount("earth", "opt-a")).toBe(1);
	});

	it("toRaw returns the underlying plain object", () => {
		const data = { earth: { "opt-a": 1 } };
		expect(new ChoiceValues(data).toRaw()).toBe(data);
	});
});

// -- CharacterLore ------------------------------------------------------------

describe("CharacterLore", () => {
	it("values returns an empty ChoiceValues when no values saved", () => {
		const lore = new CharacterLore(new FakeActorBuilder().build());
		expect(lore.values).toBeInstanceOf(ChoiceValues);
		expect(lore.values.getCount("earth", "opt-a")).toBe(0);
	});

	it("values returns a ChoiceValues wrapping the saved data", () => {
		const lore = makeLore({ earth: { "opt-a": 2 } });
		expect(lore.values.getCount("earth", "opt-a")).toBe(2);
	});

	it("set stores the updated value", async () => {
		const lore = makeLore();
		await lore.set("earth", "opt-a", 1);
		expect(lore.values.getCount("earth", "opt-a")).toBe(1);
	});

	it("set merges new value into existing data", async () => {
		const lore = makeLore({ earth: { "opt-a": 1 } });
		await lore.set("earth", "opt-b", 2);
		expect(lore.values.getCount("earth", "opt-a")).toBe(1);
		expect(lore.values.getCount("earth", "opt-b")).toBe(2);
	});

	it("set works for text values", async () => {
		const lore = makeLore();
		await lore.set("earth", "opt-text", "my answer");
		expect(lore.values.getText("earth", "opt-text")).toBe("my answer");
	});
});

// -- CharacterLore.buildSnapshot ----------------------------------------------

describe("CharacterLore.buildSnapshot", () => {
	it("returns an array of ChoiceGroup", () => {
		const result = makeLore().buildSnapshot(LORE_DATA);
		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toBeInstanceOf(ChoiceGroup);
	});

	it("includes one ChoiceGroup per lore entry", () => {
		expect(makeLore().buildSnapshot(LORE_DATA)).toHaveLength(1);
	});

	it("ChoiceGroup has the entry slug", () => {
		expect(makeLore().buildSnapshot(LORE_DATA)[0].slug).toBe("earth");
	});

	it("returns empty array when loreData is absent", () => {
		expect(makeLore().buildSnapshot(undefined)).toHaveLength(0);
	});

	it("returns empty array when loreData is empty", () => {
		expect(makeLore().buildSnapshot([])).toHaveLength(0);
	});

	it("first list item is a HeadingRow with entry title and description", () => {
		const row = makeLore().buildSnapshot(LORE_DATA)[0].list[0];
		expect(row).toBeInstanceOf(HeadingRow);
		expect(row.type).toBe("heading");
		expect(row.content.title).toBe("The Earth");
		expect(row.content.text).toBe("<p>The earth knows.</p>");
	});

	it("heading+track row reflects stored count in checks array", () => {
		const snap = makeLore({ earth: { "opt-a": 1 } }).buildSnapshot(LORE_DATA);
		const row = snap[0].list.find(r => r.type === "heading" && r.track?.slug === "opt-a");
		expect(row).toBeInstanceOf(HeadingRow);
		expect(row.track.checks).toEqual([true]);
	});

	it("heading+track checks default to all false when count is 0", () => {
		const snap = makeLore().buildSnapshot(LORE_DATA);
		const row = snap[0].list.find(r => r.type === "heading" && r.track?.slug === "opt-b");
		expect(row).toBeInstanceOf(HeadingRow);
		expect(row.track.checks).toEqual([false, false, false]);
	});

	it("text option heading reflects saved value in input.value", () => {
		const snap = makeLore({ earth: { "opt-text-input": "my answer" } }).buildSnapshot(LORE_DATA);
		const row = snap[0].list.find(r => r.slug === "opt-text");
		expect(row).toBeInstanceOf(HeadingRow);
		expect(row.input.value).toBe("my answer");
	});

	it("text option heading input.value defaults to empty string when not saved", () => {
		const snap = makeLore().buildSnapshot(LORE_DATA);
		const row = snap[0].list.find(r => r.slug === "opt-text");
		expect(row.input.value).toBe("");
	});

	it("text option heading input.placeholder reflects item placeholder", () => {
		const dataWithPlaceholder = [{
			slug: "earth", list: [{ type: "heading", slug: "opt-text", content: { text: "A text question" }, input: { placeholder: "e.g. level 3" } }],
		}];
		const snap = makeLore().buildSnapshot(dataWithPlaceholder);
		const row = snap[0].list.find(r => r.slug === "opt-text");
		expect(row.input.placeholder).toBe("e.g. level 3");
	});

	it("text option heading input.placeholder is null when item has none", () => {
		const snap = makeLore().buildSnapshot(LORE_DATA);
		const row = snap[0].list.find(r => r.slug === "opt-text");
		expect(row.input.placeholder).toBeNull();
	});

	it("plain heading (no track) becomes a HeadingRow with null track", () => {
		const snap = makeLore().buildSnapshot(LORE_DATA);
		const rows = snap[0].list.filter(r => r.type === "heading");
		const optHeading = rows.find(r => !r.content?.title && r.track === null && !r.input);
		expect(optHeading).toBeInstanceOf(HeadingRow);
		expect(optHeading.content.text).toBe("<p>A heading with no max</p>");
	});
});
