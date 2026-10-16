import { describe, it, expect, vi } from "vitest";
import { ImprovementEditorView, KnownMoment } from "../../../../src/model/snapshot/steading/ImprovementEditorView.js";
import { ImprovementAuthoring } from "../../../../src/item/ImprovementAuthoring.js";
import { ImprovementEditing } from "../../../../src/item/ImprovementEditing.js";
import { ImprovementResult } from "../../../../src/model/data/steading/ImprovementResult.js";

const WORDING = {
	heading: (rule, first) => ({ all: ["Requires all:", "And then:"], some: [`Requires ${rule.count}:`, `And ${rule.count}:`] }[rule.kind]?.[first ? 0 : 1] ?? null),
	result:  r => (r.does === "change" ? `up ${r.rating} ${r.amount}` : null),
	follow:  (_before, after) => after,
};
const line = text => ({ type: "entry", content: { title: null, text }, track: null });
const req  = (slug, max = 1) => ({ type: "entry", slug, content: { title: null, text: slug }, track: { max } });

const SYSTEM = () => ({
	slug: "w",
	choices: { slug: "w", list: [line("Intro"), line("Requires all:"), req("a", 3), line("And 1:"), req("b"), req("c")] },
	requires: { all: ["a", { any: 1, of: ["b", "c"] }] },
	effects: [
		{ when: { kind: "completed" }, change: { target: "fortunes", amount: 1 }, text: "up fortunes 1" },
		{ when: { kind: "turn", seasons: ["spring"] }, text: "you are extra happy" },
		{ when: { kind: "completed" }, grantsMove: "lead-the-aurochs-hunt", text: "lead the hunt" },
	],
});

function view(system = SYSTEM(), { editing = new ImprovementEditing(), moments = [] } = {}) {
	const item = { name: "Watchtower", system, update: vi.fn() };
	return ImprovementEditorView.from(new ImprovementAuthoring(item, WORDING), { editing, moments, label: key => `«${key}»`, prefix: "sheet" });
}

describe("ImprovementEditorView — the rows, grouped as the card groups them", () => {
	it("groups each heading with the requirements under it, and leaves a line on its own", () => {
		const blocks = view().blocks;
		expect(blocks.map(b => b.isSection ? ["section", b.heading.index, b.requirements.map(r => r.index)] : ["line", b.line.index]))
			.toEqual([["line", 0], ["section", 1, [2]], ["section", 3, [4, 5]]]);
	});

	it("draws a requirement's boxes, none ticked", () => {
		expect(view().blocks[1].requirements[0].checks).toEqual([false, false, false]);
	});

	it("knows where a requirement stands in its section", () => {
		const [b, c] = view().blocks[2].requirements;
		expect([b.isFirstInSection, b.isLastInSection, c.isLastInSection, b.isOnlyInSection]).toEqual([true, false, true, false]);
		expect(view().blocks[1].requirements[0].isOnlyInSection).toBe(true);
	});

	it("knows the first and last block, for moving them", () => {
		const blocks = view().blocks;
		expect([blocks[0].isFirst, blocks[2].isLast, blocks[1].isFirst]).toEqual([true, true, false]);
	});
});

describe("ImprovementEditorView — a heading's rule", () => {
	it("offers its rules as a line of words, the live one checked", () => {
		const heading = view().blocks[2].heading;
		expect(heading.ruleModes.map(m => [m.key, m.checked])).toEqual([["all", false], ["some", true], ["or", false]]);
		expect([heading.isSome, heading.count]).toEqual([true, 1]);
	});

	// "Or instead" is instead of the section above; the first section has none.
	it("offers the first section no 'or instead'", () => {
		expect(view().blocks[1].heading.ruleModes.map(m => m.key)).toEqual(["all", "some"]);
	});

	// "None of these count" is the book's Militia: kept where it is the rule, never offered.
	it("shows 'none of these count' only where it is already the rule", () => {
		const militia = SYSTEM();
		militia.requires = { all: ["a"] };
		expect(view(militia).blocks[2].heading.ruleModes.map(m => m.key)).toEqual(["all", "some", "none", "or"]);
	});

	it("marks the heading whose editor is open", () => {
		const editing = new ImprovementEditing();
		editing.openHeading(3);
		expect(view(SYSTEM(), { editing }).blocks.map(b => b.heading?.isOpen ?? null)).toEqual([null, false, true]);
	});

	it("knows a heading still in its generated words from one in the author's", () => {
		const own = SYSTEM();
		own.choices.list[1].content.text = "Requires all, in order:";
		expect(view().blocks[1].heading.isGenerated).toBe(true);
		expect(view(own).blocks[1].heading.canUseGenerated).toBe(true);
	});
});

describe("ImprovementEditorView — the results", () => {
	it("splits the results into the card's two halves", () => {
		const [completion, henceforth] = view().halves;
		expect(completion.results.map(r => r.index)).toEqual([0, 2]);
		expect(henceforth.results.map(r => r.index)).toEqual([1]);
	});

	it("states a result as the card does: its words, and its timing where it has no clause", () => {
		const happy = view().halves[1].results[0];
		expect(happy.text.raw).toBe("you are extra happy");
		expect(happy.timingKeys.length).toBeGreaterThan(0);
	});

	it("offers each of its choices as a line of words", () => {
		const fortunes = view().halves[0].results[0];
		expect(fortunes.doesModes.find(m => m.checked).key).toBe("change");
		expect(fortunes.ratingModes.find(m => m.checked).key).toBe("fortunes");
		const happy = view().halves[1].results[0];
		expect(happy.whenModes.map(m => [m.key, m.checked])).toEqual([["turn", true], ["moment", false], ["standing", false]]);
		expect(happy.outcomeModes[0]).toMatchObject({ key: "", checked: true });
	});

	it("keeps a mechanic it cannot author, naming the move it grants", () => {
		const hunt = view().halves[0].results[1];
		expect([hunt.isMechanicEditable, hunt.isMove, hunt.moveSlug]).toEqual([false, true, "lead-the-aurochs-hunt"]);
	});

	it("draws the adder's draft in the half it was opened in", () => {
		const editing = new ImprovementEditing();
		editing.openAdder("henceforth", ImprovementResult.henceforth().withText("the bells ring"));
		const [completion, henceforth] = view(SYSTEM(), { editing }).halves;
		expect(completion.adder).toBeNull();
		expect([henceforth.adder.isAdder, henceforth.adder.words]).toEqual([true, "the bells ring"]);
	});
});

/** A moment is typed; the field offers the moments improvements already use in its seasons. */
describe("ImprovementEditorView — a result at a moment", () => {
	const moments = [
		new KnownMoment({ key: "autumn-harvest", label: "The autumn harvest", seasons: ["autumn"], shared: true }),
		new KnownMoment({ key: "aurochs-hunt", label: "The aurochs hunt", seasons: ["spring"], shared: true }),
	];
	const atMoment = when => {
		const system = SYSTEM();
		system.effects = [{ when: { kind: "moment", ...when }, text: "t" }];
		return view(system, { moments }).halves[1].results[0];
	};

	it("offers the moments used in its seasons, and its season boxes", () => {
		const r = atMoment({ seasons: ["autumn"] });
		expect(r.seasons.filter(s => s.checked).map(s => s.key)).toEqual(["autumn"]);
		expect(r.momentField.options).toEqual(["The autumn harvest"]);
	});

	it("shows the book's moment by its translated name, and an author's by their words", () => {
		expect(atMoment({ seasons: ["autumn"], moment: "autumn-harvest" }).momentField.text).toBe("«stonetop.steading.seasons.moments.autumn-harvest»");
		expect(atMoment({ seasons: ["spring"], moment: "custom-moment-x", momentName: "the festival" }).momentField.text).toBe("the festival");
	});
});
