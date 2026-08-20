import { describe, it, expect } from "vitest";
import { buildChoiceGroup } from "../../../../src/model/snapshot/character/buildChoiceGroup.js";
import { ChoiceValues } from "../../../../src/model/snapshot/character/ChoiceGroup.js";
import { rich } from "../../../../src/model/snapshot/RichText.js";

// A locked sheet renders a choice group condensed: the group's own prose, and one line per thing
// the player actually chose. Everything else on those rows — the options not taken, the empty
// write-ins, the instructions introducing nothing — is the editor's furniture.

const group = (def, values = {}) => buildChoiceGroup(def, new ChoiceValues(values));
const raw   = value => rich(value).raw;
const shape = blocks => blocks.map(b => ({
	title: raw(b.title), lead: raw(b.lead), lines: b.lines.map(l => raw(l.text)),
}));

const TALL_TALES = { slug: "tall-tales", list: [
	{ type: "entry", content: { title: "There Was That Time You…", text: "Mix and match. *(choose 1 per tale)*" } },
	{ type: "entry", slug: "great-wood", content: { text: "… got lost in the Great Wood." }, track: { max: 1 } },
	{ type: "entry", slug: "the-flats",  content: { text: "… got lost in the Flats." },      track: { max: 1 } },
]};

const APPEARANCE = { slug: "appearance", list: [
	{ type: "pick", pickCount: 1, inline: true, options: [
		{ slug: "young-pup", text: "young pup" }, { slug: "old-timer", text: "cagey old-timer" },
	]},
	{ type: "pick", pickCount: 1, inline: true, options: [
		{ slug: "lithe", text: "lithe" }, { slug: "heavyset", text: "heavyset" },
	]},
]};

const QUESTIONS = { slug: "intro-npc", list: [
	{ type: "entry", slug: "favour", content: { text: "Who do you owe a favour?" }, input: { type: "inline" } },
	{ type: "entry", slug: "feud",   content: { text: "Who do you feud with?" },    input: { type: "inline" } },
]};

describe("ChoiceGroup#condensed", () => {
	it("is empty when nothing has been chosen", () => {
		expect(group(TALL_TALES).condensed).toEqual([]);
		expect(group(APPEARANCE).condensed).toEqual([]);
		expect(group(QUESTIONS).condensed).toEqual([]);
	});

	// The prose is what the ticked line is answering, so it stays — above the line, not as one.
	it("keeps the group's prose above the lines it introduces", () => {
		const ticked = group(TALL_TALES, { "tall-tales": { "the-flats": 1 } });
		expect(shape(ticked.condensed)).toEqual([{
			title: "There Was That Time You…",
			lead:  "Mix and match. *(choose 1 per tale)*",
			lines: ["… got lost in the Flats."],
		}]);
	});

	it("lists every ticked line under the one lead", () => {
		const ticked = group(TALL_TALES, { "tall-tales": { "the-flats": 1, "great-wood": 1 } });
		expect(shape(ticked.condensed)[0].lines)
			.toEqual(["… got lost in the Great Wood.", "… got lost in the Flats."]);
	});

	// A prompt mid-group only earns its place once something under it is chosen; a heading further
	// up stands on its own so the group is still named.
	it("holds prose back until a choice below it is reviewed", () => {
		const pouch = { slug: "pouch", list: [
			{ type: "entry", content: { title: "Sacred Pouch", text: "It doesn't take up space." } },
			{ type: "entry", content: { text: "Your pouch is…" } },
			{ type: "entry", slug: "fur", content: { text: "fur" }, track: { max: 1 } },
			{ type: "entry", content: { text: "What trait does it possess?" } },
			{ type: "entry", slug: "uncut", content: { text: "It cannot be cut." }, track: { max: 1 } },
		]};

		expect(shape(group(pouch, { pouch: { fur: 1 } }).condensed)).toEqual([
			{ title: "Sacred Pouch", lead: "It doesn't take up space.", lines: [] },
			{ title: "",             lead: "Your pouch is…",            lines: ["fur"] },
		]);

		expect(shape(group(pouch, { pouch: { fur: 1, uncut: 1 } }).condensed)).toEqual([
			{ title: "Sacred Pouch", lead: "It doesn't take up space.",        lines: [] },
			{ title: "",             lead: "Your pouch is…",                   lines: ["fur"] },
			{ title: "",             lead: "What trait does it possess?",      lines: ["It cannot be cut."] },
		]);
	});

	// The editor shows an entry title's note beside it ("(choose 1 or 2 per tale)"); the condensed
	// heading is the same heading, so it keeps its aside.
	it("keeps a heading's note with the heading", () => {
		const noted = { slug: "tales", list: [
			{ type: "entry", content: { title: "And You Ended Up…", titleNote: "(choose 1 or 2 per tale)" } },
			{ type: "entry", slug: "treasure", content: { text: "… with a sack full of treasure." }, track: { max: 1 } },
		]};
		const [block] = group(noted, { tales: { treasure: 1 } }).condensed;
		expect(raw(block.title)).toBe("And You Ended Up…");
		expect(raw(block.titleNote)).toBe("(choose 1 or 2 per tale)");
		expect(block.lines.map(l => raw(l.text))).toEqual(["… with a sack full of treasure."]);
	});

	// One line, not one per row: the words are fragments of a single description.
	it("joins the picks from a run of inline rows onto one line", () => {
		const picked = group(APPEARANCE, { appearance: { "young-pup": 1, lithe: 1 } });
		expect(shape(picked.condensed)).toEqual([{ title: "", lead: "", lines: ["young pup · lithe"] }]);
	});

	it("gives a card pick its own line, with its description alongside", () => {
		const backgrounds = { slug: "bg", list: [
			{ type: "pick", pickCount: 1, options: [
				{ slug: "reading", content: { title: "Reading", text: "Letters and numbers." } },
				{ slug: "fighting", content: { title: "Fighting", text: "Dirty, if need be." } },
			]},
		]};
		const [block] = group(backgrounds, { bg: { fighting: 1 } }).condensed;
		expect(raw(block.lines[0].text)).toBe("Fighting");
		expect(raw(block.lines[0].detail)).toBe("Dirty, if need be.");
	});

	// The question is prose like any other lead; the answer is the line.
	it("reads a write-in as its question then the answer", () => {
		const answered = group(QUESTIONS, { "intro-npc": { "favour-input": "Bhelu" } });
		expect(shape(answered.condensed)).toEqual([
			{ title: "", lead: "Who do you owe a favour?", lines: ["Bhelu"] },
		]);
	});

	// An invocation carries its name in `content.subtitle` (title is null, the rules text is the
	// body) — read title-only and the line opens with a rules paragraph and never names the thing.
	it("names a line by its subtitle when that is where the name lives", () => {
		const invocations = { slug: "invocations", list: [
			{ type: "entry", slug: "blinding", track: { max: 1 },
			  content: { title: null, subtitle: "Blinding Light", subtitleNote: "(ongoing)",
			             text: "Your light blazes." } },
		]};
		const [block] = group(invocations, { invocations: { blinding: 1 } }).condensed;
		expect(raw(block.lines[0].text)).toBe("Blinding Light");
		expect(raw(block.lines[0].note)).toBe("(ongoing)");
		expect(raw(block.lines[0].detail)).toBe("Your light blazes.");
	});

	it("falls back to the body text when a row has no name of its own", () => {
		const [block] = group(TALL_TALES, { "tall-tales": { "the-flats": 1 } }).condensed;
		expect(raw(block.lines[0].text)).toBe("… got lost in the Flats.");
		expect(block.lines[0].detail).toBe(null);
	});

	it("reads a fill-in option as the text written into it", () => {
		const gear = { slug: "gear", list: [
			{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "other", type: "input", text: "other" }] },
		]};
		const picked = group(gear, { gear: { other: 1, "other-fill": "a wolf's tooth" } });
		expect(shape(picked.condensed)[0].lines).toEqual(["a wolf's tooth"]);
	});

	// The sheet enriches the snapshot tree once, before anything renders; the condensed view is
	// built from that same tree, so its text must BE those nodes, not copies of their strings.
	it("hands back the group's own RichText nodes", () => {
		const ticked = group(TALL_TALES, { "tall-tales": { "the-flats": 1 } });
		const [block] = ticked.condensed;
		expect(block.title).toBe(ticked.list[0].content.title);
		expect(block.lead).toBe(ticked.list[0].content.text);
		expect(block.lines[0].text).toBe(ticked.list[2].content.text);
	});
});
