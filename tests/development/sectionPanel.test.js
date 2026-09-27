import { describe, it, expect } from "vitest";
import { sectionPanel, choiceRows, condensedBlocks, tickedLine } from "../../scripts/development/redesign-mock/parts.js";
import { ChoiceSection } from "../../scripts/development/redesign-mock/sections.js";

/**
 * The Playbook tab's and the insert tab's one section, and what goes in it.
 *
 * D11: a section rests on what was chosen, and one door opens the rest in place. What goes INSIDE is
 * the shipped sheet's own markup — `choice-row.hbs` while choosing, `choice-group-condensed.hbs` at
 * rest — so these guard that the deck draws the shipped classes, not a look of its own.
 */

const rich = raw => ({ raw, autoRoll: false, html: raw });
const content = ({ title = "", text = "", subtitle = "", subtitleNote = "" } = {}) => ({
	title: rich(title), titleNote: rich(""), subtitle: rich(subtitle), subtitleNote: rich(subtitleNote), text: rich(text),
});
const heading = (title, text = "") => ({ type: "entry", slug: null, content: content({ title, text }), track: null, input: null });
const boxed = (slug, text, marked = false, extra = {}) => ({ type: "entry", slug, content: content({ text, ...extra }),
	track: { slug, checks: [marked], requires: null }, input: null });
const question = (slug, text, value = "") => ({ type: "entry", slug, content: content({ text }), track: null,
	input: { slug: `${slug}-input`, placeholder: null, value, type: "inline" } });
const option = (slug, text, checked = false, description = "") => ({ slug, text: rich(text), description: rich(description), checked });
const pickRow = (options, { radio = true, rowKey = "row-0", inline = true } = {}) => ({ type: "choice", radio, rowKey, inline, options });

const section = (list, key = "k") => new ChoiceSection({ slug: "g", list }, key);

describe("sectionPanel", () => {
	const args = { key: "insert-thrall/consequences", title: "Consequences",
		restBody: "<p>REST</p>", openBody: "<p>OPEN</p>", door: "Change" };

	// The door is on the bar, where Done appears: a section costs its bar and its lines, no row more.
	it("rests on what was chosen, with its door on the bar", () => {
		const html = sectionPanel(args);
		expect(html).toContain("REST");
		expect(html).not.toContain("OPEN");
		expect(html).toContain('data-section-door="insert-thrall/consequences" aria-expanded="false">Change</button>');
		expect(html).not.toContain("rd-door-btn");
	});

	it("opens in place with Done where the door was, and the instruction beside the title", () => {
		const html = sectionPanel({ ...args, open: true, note: "(Choose 1)" });
		expect(html).toContain("OPEN");
		expect(html).not.toContain("REST");
		expect(html).toContain('aria-expanded="true">Done</button>');
		expect(html).not.toContain(">Change<");
		expect(html).toContain("(Choose 1)");
	});

	it("keeps the instruction off the bar while resting", () => {
		expect(sectionPanel({ ...args, note: "(Choose 1)" })).not.toContain("(Choose 1)");
	});

	// "1 of 6" read as five picks still owed on a pick-one list. The instruction says how many.
	it("carries no count", () => {
		expect(sectionPanel(args)).not.toContain("rd-count");
	});

	it("has no door when there is nothing to choose", () => {
		expect(sectionPanel({ ...args, door: null })).not.toContain("data-section-door");
	});
});

describe("choiceRows — the shipped choice-row while choosing", () => {
	// A pick is the system's own square inside the shipped option label: no chip, no bare radio.
	it("draws a word to pick as the shipped option label with the system's check", () => {
		const html = choiceRows(section([pickRow([option("young", "young", true), option("old", "old")])],
			"playbook/appearance"));
		expect(html).toContain('<div class="stonetop-choice-row stonetop-choice-row--inline">');
		expect(html).toContain('class="stonetop-choice-option-label is-checked"');
		expect(html).toContain('class="stonetop-item-check stonetop-cg-pick"');
		expect(html).toContain('name="playbook/appearance:row-0"');
		expect(html).toContain('data-mark="playbook/appearance" data-item="young"');
	});

	it("draws an option with a sentence as the shipped card", () => {
		const html = choiceRows(section([pickRow([option("shame", "Shame", false, "To hide")], { inline: false })]));
		expect(html).toContain('<label class="stonetop-item">');
		expect(html).toContain('<strong class="stonetop-item-name">Shame</strong>');
		expect(html).toContain('<div class="stonetop-item-description">To hide</div>');
	});

	it("draws a line with a box as the shipped track row", () => {
		const html = choiceRows(section([boxed("quarry", "QUARRY", true)], "insert-thrall/consequences"));
		expect(html).toContain('<div class="stonetop-choice-track stonetop-row">');
		expect(html).toContain('class="stonetop-cg-track"');
		expect(html).toContain('aria-label="Track 1 of 1"');
		expect(html).toContain('<span class="stonetop-choice-track-desc stonetop-choice-track-desc-row">QUARRY</span>');
		expect(html).toContain(" checked");
	});

	// An invocation: the name is a sub-heading beside the box, and its text is always shown.
	it("draws a named line with its sub-heading and its text in full", () => {
		const html = choiceRows(section([boxed("blinding-light", "Your light blazes.", false,
			{ subtitle: "Blinding Light", subtitleNote: "(ongoing)" })]));
		expect(html).toContain('<div class="stonetop-choice-track stonetop-column">');
		expect(html).toContain('<h4 class="stonetop-move-group-sub-heading">Blinding Light <span class="stonetop-section-note">(ongoing)</span></h4>');
		expect(html).toContain('<span class="stonetop-choice-track-desc">Your light blazes.</span>');
	});

	it("draws a question as its words and the shipped single-line blank", () => {
		const html = choiceRows(section([question("where", "Where did you acquire it?", "A barrow")],
			"playbook/lore/arcana-major"));
		expect(html).toContain('<div class="stonetop-choice-description">Where did you acquire it?</div>');
		expect(html).toContain('class="stonetop-cg-text stonetop-choice-input stonetop-choice-input--inline stonetop-grow-field"');
		expect(html).toContain('data-answer="playbook/lore/arcana-major" data-item="where"');
		expect(html).toContain(">A barrow</textarea>");
	});

	it("wears the shipped wrapper's extra class where it has one", () => {
		expect(choiceRows(section([boxed("a", "A")]), { klass: "stonetop-instinct-options" }))
			.toContain('<div class="stonetop-choice-entry stonetop-instinct-options">');
	});

	it("prints an entry's own title, but not the one the bar already carries", () => {
		const rows = section([heading("Consequences", "Choose 1."), boxed("a", "A")]);
		expect(choiceRows(rows)).toContain('<p class="stonetop-choice-entry-title">Consequences</p>');
		const html = choiceRows(rows, { omitTitle: "Consequences" });
		expect(html).not.toContain("stonetop-choice-entry-title");
		expect(html).toContain('<div class="stonetop-choice-description">Choose 1.</div>');
	});
});

describe("condensedBlocks — the shipped locked view", () => {
	it("draws a ticked line with the tick where its box was", () => {
		const html = condensedBlocks(section([heading("Consequences", "Choose 1."), boxed("quarry", "QUARRY", true)]).condensed);
		expect(html).toContain('<span class="stonetop-choice-tick" aria-hidden="true">✓</span>');
		expect(html).toContain('<span class="stonetop-choice-track-desc stonetop-choice-track-desc-row">QUARRY</span>');
		expect(html).toContain('<div class="stonetop-choice-description">Choose 1.</div>');
		expect(html).not.toContain("<input");
	});

	it("leaves out the title the bar already carries", () => {
		const blocks = section([heading("Consequences"), boxed("quarry", "QUARRY", true)]).condensed;
		expect(condensedBlocks(blocks)).toContain("stonetop-choice-entry-title");
		expect(condensedBlocks(blocks, { omitTitle: "Consequences" })).not.toContain("stonetop-choice-entry-title");
	});

	it("keeps a named line's sub-heading and text", () => {
		const html = condensedBlocks(section([boxed("blinding-light", "Your light blazes.", true,
			{ subtitle: "Blinding Light", subtitleNote: "(ongoing)" })]).condensed);
		expect(html).toContain('<div class="stonetop-choice-track stonetop-column">');
		expect(html).toContain("Blinding Light");
		expect(html).toContain("Your light blazes.");
	});

	it("keeps a described pick's card", () => {
		const html = condensedBlocks(section([pickRow([option("shame", "Shame", true, "To hide")], { inline: false })]).condensed);
		expect(html).toContain('<div class="stonetop-item is-checked">');
		expect(html).toContain('<div class="stonetop-item-description">To hide</div>');
	});

	it("draws nothing for nothing chosen", () => {
		expect(condensedBlocks([])).toBe("");
	});
});

/* The locked view's plain line, for a section that is not a choice group — the instinct's computed
   label, the origin's region — so it rests in the same shape as its neighbours. */
describe("tickedLine", () => {
	it("draws the locked view's row: the tick where the box was, then the words", () => {
		const html = tickedLine("Gordin's Delve");
		expect(html).toContain('<div class="stonetop-choice-track stonetop-row">');
		expect(html).toContain('<span class="stonetop-choice-tick" aria-hidden="true">✓</span>');
		expect(html).toContain('<span class="stonetop-choice-track-desc stonetop-choice-track-desc-row">Gordin\'s Delve</span>');
		expect(html).not.toContain("<strong>");
	});

	it("takes an extra class — an instinct set aside", () => {
		expect(tickedLine("Curiosity", { klass: "is-set-aside" })).toContain('class="stonetop-choice-track stonetop-row is-set-aside"');
	});

	it("is the same line the condensed view draws for a ticked row", () => {
		const blocks = section([boxed("quarry", "QUARRY", true)]).condensed;
		expect(condensedBlocks(blocks).replace(/\s+/g, " ")).toContain(tickedLine("QUARRY").replace(/\s+/g, " "));
	});
});
