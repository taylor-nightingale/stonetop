import { describe, it, expect, vi } from "vitest";
import { ImprovementAuthoring } from "../../src/item/ImprovementAuthoring.js";
import { ImprovementWording } from "../../src/model/data/steading/ImprovementWording.js";
import { applyDocumentUpdate } from "../fakes/foundry/applyDocumentUpdate.js";

// The item merges its updates the way Foundry's does, so a requirement that changed shape by writing
// over the old one would keep both keys here exactly as it would in the game.
function makeItem(system = {}) {
	const item = { name: "Watchtower", system: structuredClone(system) };
	item.update = vi.fn(async data => applyDocumentUpdate(item, data));
	return item;
}

// The real wording, over templates the test controls.
const W = "stonetop.improvement.wording";
const STRINGS = {
	[`${W}.heading.first.all`]: "Requires all:", [`${W}.heading.later.all`]: "And then:",
	[`${W}.heading.first.some`]: "Requires {count}:", [`${W}.heading.later.some`]: "And {count}:",
	[`${W}.result.increase`]: "up {rating} {amount}", [`${W}.result.decrease`]: "down {rating} {amount}",
	"stonetop.steading.attr.fortunes": "fortunes", "stonetop.steading.attr.surplus": "surplus",
};
const WORDING = new ImprovementWording({
	has:      key => typeof STRINGS[key] === "string",
	localize: key => STRINGS[key] ?? key,
	format:   (key, data = {}) => (STRINGS[key] ?? key).replace(/\{(\w+)\}/g, (_, n) => data[n] ?? ""),
});

const line = text => ({ type: "entry", content: { title: null, text }, track: null });
const req  = slug => ({ type: "entry", slug, content: { title: null, text: slug }, track: { max: 1 } });
const WATCHTOWER = () => ({
	slug: "watchtower",
	choices: { slug: "watchtower", list: [line("Requires all:"), req("a"), req("b")] },
	requires: { all: ["a", "b"] },
	effects: [
		{ when: { kind: "completed" }, change: { target: "fortunes", amount: 1 }, text: "up fortunes 1" },
		{ when: { kind: "turn", seasons: ["spring"] }, text: "you are extra happy" },
	],
});
const authoring = (system = WATCHTOWER()) => {
	const item = makeItem(system);
	return { item, a: new ImprovementAuthoring(item, WORDING) };
};

describe("ImprovementAuthoring — rows", () => {
	const TWO = () => ({
		...WATCHTOWER(),
		choices: { slug: "watchtower", list: [line("Requires all:"), req("a"), req("b"), line("And then:"), req("c")] },
		requires: { all: ["a", "b", "c"] },
	});

	it("adds a requirement to a section, and the rule follows", async () => {
		const { item, a } = authoring();
		await a.addRequirementTo(0);
		expect(item.system.requires).toEqual({ all: ["a", "b", item.system.choices.list[3].slug] });
	});

	it("adds a heading as a new section, and a line of text", async () => {
		const { item, a } = authoring();
		await a.addHeading();
		expect(item.system.choices.list.at(-2).content.text).toBe("And then:");
		await a.addLine();
		expect(item.system.choices.list.at(-1).track).toBeNull();
	});

	it("words and removes a row", async () => {
		const { item, a } = authoring();
		await a.setRowText(1, "An engineer");
		expect(item.system.choices.list[1].content.text).toBe("An engineer");
		await a.removeRow(1);
		expect(item.system.requires).toEqual({ all: ["b"] });
	});

	it("removes a section whole, and folds one into the section above when its heading goes", async () => {
		let { item, a } = authoring(TWO());
		await a.removeSection(3);
		expect(item.system.requires).toEqual({ all: ["a", "b"] });
		({ item, a } = authoring(TWO()));
		await a.removeHeading(3);
		expect(item.system.choices.list.map(r => r.slug ?? r.content.text)).toEqual(["Requires all:", "a", "b", "c"]);
	});

	it("moves a section whole, and a requirement within its section", async () => {
		let { item, a } = authoring(TWO());
		await a.moveBlock(1, -1);
		expect(item.system.choices.list.map(r => r.slug ?? r.content.text)).toEqual(["Requires all:", "c", "And then:", "a", "b"]);
		({ item, a } = authoring(TWO()));
		await a.moveRequirement(2, -1);
		expect(item.system.choices.list.map(r => r.slug ?? null)).toEqual([null, "b", "a", null, "c"]);
	});

	it("steps a requirement's boxes, never below one", async () => {
		const { item, a } = authoring();
		await a.stepBoxes(1, 1);
		expect(item.system.choices.list[1].track.max).toBe(2);
		await a.stepBoxes(1, -1);
		await a.stepBoxes(1, -1);
		expect(item.system.choices.list[1].track.max).toBe(1);
	});

	// `requires` is an ObjectField, and Foundry merges those: {any, of} written over {all} keeps
	// `all`, which the parser reads first.
	it("switches a section to some of these without leaving the all-of list behind", async () => {
		const { item, a } = authoring();
		await a.setSectionRule(0, "some", 1);
		expect(item.system.requires).toEqual({ any: 1, of: ["a", "b"] });
		expect(item.system.choices.list[0].content.text).toBe("Requires 1:");
	});

	it("puts a heading back into its generated words", async () => {
		const { item, a } = authoring();
		await a.setRowText(0, "Requires all, in order:");
		await a.useGeneratedHeading(0);
		expect(item.system.choices.list[0].content.text).toBe("Requires all:");
	});

	it("renames the improvement", async () => {
		const { item, a } = authoring();
		await a.rename("Watch Tower");
		expect(item.update).toHaveBeenCalledWith({ name: "Watch Tower" });
	});
});

describe("ImprovementAuthoring — results", () => {
	it("drafts a result for either half, written only when added", async () => {
		const { item, a } = authoring();
		const draft = ImprovementAuthoring.draftFor("henceforth");
		expect(draft.when).toBe("turn");
		expect(ImprovementAuthoring.draftFor("completion").isCompletion).toBe(true);
		expect(item.update).not.toHaveBeenCalled();
		await a.addResult(draft.withText("the bells ring"));
		expect(item.system.effects.at(-1)).toMatchObject({ when: { kind: "turn" }, text: "the bells ring" });
	});

	it("rewrites a result's generated words when its choices change", async () => {
		const { item, a } = authoring();
		await a.changeResult(0, r => r.withAmount(2));
		expect(item.system.effects[0].change.amount).toBe(2);
		expect(item.system.effects[0].text).toBe("up fortunes 2");
	});

	it("keeps a result's own words when its choices change", async () => {
		const { item, a } = authoring();
		await a.setResultText(0, "a party, and +1 Fortunes");
		await a.changeResult(0, r => r.withAmount(2));
		expect(item.system.effects[0].text).toBe("a party, and +1 Fortunes");
	});

	it("gives a result the generated words back", async () => {
		const { item, a } = authoring();
		await a.setResultText(0, "a party");
		await a.useGeneratedResultWords(0);
		expect(item.system.effects[0].text).toBe("up fortunes 1");
	});

	// Results are listed by half on the card; moving one steps past its neighbour in the SAME half,
	// since stepping past one in the other half would change nothing the author can see.
	it("moves a result within its own half", async () => {
		const system = WATCHTOWER();
		system.effects.push({ when: { kind: "completed" }, text: "second" });
		const { item, a } = authoring(system);
		await a.moveResult(2, -1);
		expect(item.system.effects.map(e => e.text)).toEqual(["second", "you are extra happy", "up fortunes 1"]);
	});

	it("removes a result", async () => {
		const { item, a } = authoring();
		await a.removeResult(0);
		expect(item.system.effects.map(e => e.text)).toEqual(["you are extra happy"]);
	});
});

describe("ImprovementAuthoring.onPreCreate", () => {
	const example = { name: "Example Improvement", system: slug => ({ slug, choices: { slug, list: [] }, requires: { all: [] }, effects: [] }) };
	class FakeItem {
		static defaultName() { return "New Improvement"; }
		constructor(system = {}, { parent = null, pack = null } = {}) { this.type = "improvement"; this.system = system; this.parent = parent; this.pack = pack; this.changes = null; }
		updateSource(changes) { this.changes = changes; }
	}

	it("starts a new world improvement as the example, under a slug of its own", () => {
		const item = new FakeItem();
		new ImprovementAuthoring(item, WORDING).onPreCreate({ name: "New Improvement" }, example);
		expect(item.changes.system.slug).toMatch(/^custom-improvement-/);
		expect(item.changes.name).toBe("Example Improvement");
	});

	it("keeps a name the author typed", () => {
		const item = new FakeItem();
		new ImprovementAuthoring(item, WORDING).onPreCreate({ name: "Watchtower" }, example);
		expect(item.changes.name).toBeUndefined();
	});

	it("leaves a copy, an import, an owned or a packed improvement as it is", () => {
		for (const item of [new FakeItem({ slug: "mill" }), new FakeItem({ choices: { list: [{}] } }),
			new FakeItem({}, { parent: {} }), new FakeItem({}, { pack: "x" })]) {
			new ImprovementAuthoring(item, WORDING).onPreCreate({ name: "New Improvement" }, example);
			expect(item.changes).toBeNull();
		}
	});
});
