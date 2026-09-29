import { describe, it, expect } from "vitest";
import { InsertSections } from "../../../../src/model/snapshot/character/InsertSections.js";
import { InsertSnapshotBuilder } from "../../../../src/model/snapshot/character/InsertSnapshot.js";
import { buildChoiceGroup } from "../../../../src/model/snapshot/character/buildChoiceGroup.js";
import { ChoiceValues } from "../../../../src/model/snapshot/character/ChoiceGroup.js";

// D12: an insert's tab carries its instinct and each of its sections, drawn as the Playbook tab's
// are, split across the same two fixed columns by count in the pack's order.

const group = (def, values = {}) => buildChoiceGroup(def, new ChoiceValues(values));
const titled = (slug, title, extra = {}) => ({ slug, ...extra, list: [
	{ type: "entry", content: { title, text: "The book's words." } },
	{ type: "entry", slug: `${slug}-a`, content: { text: "One." }, track: { max: 1 } },
] });
const untitled = slug => ({ slug, list: [{ type: "entry", slug: `${slug}-a`, content: { text: "One." }, track: { max: 1 } }] });

const insert = ({ slug = "thrall", name = "The Thrall", instinct = true, instinctSelected = null, choices = [] } = {}) =>
	new InsertSnapshotBuilder().withSlug(slug).withName(name)
		.withInstinctGroup(instinct ? group({ slug: "instinct", list: [{ type: "pick", pickCount: 1, options: [{ slug: "f", text: "Fascination" }] }] }) : null)
		.withInstinctSelected(instinctSelected)
		.withChoices(choices).build();

const sections = s => [...s.left, ...s.right];

describe("InsertSections.from", () => {
	it("leads with the instinct, then each group in the pack's order, keyed by the insert", () => {
		const s = InsertSections.from(insert({ choices: [group(titled("your-master", "Your Master")), group(titled("marks", "Marks"))] }));
		expect(sections(s).map(e => [e.kind, e.section.key])).toEqual([
			["instinct", "insert-thrall-instinct"], ["group", "insert-thrall-your-master"], ["group", "insert-thrall-marks"],
		]);
	});

	it("splits them across two columns by count, the first half down the left", () => {
		const choices = ["a", "b", "c", "d"].map(k => group(titled(k, k.toUpperCase())));
		const s = InsertSections.from(insert({ choices }));
		expect([s.left.length, s.right.length]).toEqual([3, 2]);
		expect(s.split).toBe(true);
	});

	it("keeps a lone section whole across the tab", () => {
		const s = InsertSections.from(insert({ slug: "invocations", instinct: false, choices: [group(untitled("lightbearer-invocations"))] }));
		expect(s.split).toBe(false);
	});

	// Invocations' one group carries no heading of its own; the insert's name heads it.
	it("titles a section from its first line, else from the insert", () => {
		const s = InsertSections.from(insert({ name: "Invocations", instinct: false, choices: [group(titled("a", "Your Master")), group(untitled("b"))] }));
		expect(sections(s).map(e => [e.title, e.titleIsLeadRow])).toEqual([["Your Master", true], ["Invocations", false]]);
	});

	// Reported: the Terrible Purpose had no Change. It is chosen like the rest.
	it("offers Choose on the Terrible Purpose, and Change once one is marked", () => {
		const door = values => sections(InsertSections.from(insert({ choices: [group(titled("terrible-purpose", "Terrible Purpose"), values)] })))
			.find(e => e.section.key === "insert-thrall-terrible-purpose").section.door;
		expect(door({})).toBe("choose");
		expect(door({ "terrible-purpose": { "terrible-purpose-a": 1 } })).toBe("change");
	});

	it("offers Change on the instinct once one is picked", () => {
		expect(InsertSections.from(insert({ instinctSelected: "Fascination" })).left[0].section.door).toBe("change");
		expect(InsertSections.from(insert()).left[0].section.door).toBe("choose");
	});

	it("lists the keys a new insert opens — every section with a door", () => {
		const choices = [group(titled("your-master", "Your Master")), group(untitled("words")), group({ slug: "prose", list: [
			{ type: "entry", content: { title: "Lore", text: "Only words." } },
		] })];
		expect(InsertSections.from(insert({ choices })).keys).toEqual(["insert-thrall-instinct", "insert-thrall-your-master", "insert-thrall-words"]);
	});
});

describe("InsertSnapshot.sections", () => {
	it("is derived from the insert", () => {
		expect(insert().sections).toBeInstanceOf(InsertSections);
	});
});
