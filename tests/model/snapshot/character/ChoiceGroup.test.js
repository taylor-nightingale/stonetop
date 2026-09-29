import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ChoiceValues, EntryInput } from "../../../../src/model/snapshot/character/ChoiceGroup.js";
import { buildChoiceGroup } from "../../../../src/model/snapshot/character/buildChoiceGroup.js";
import { RichText } from "../../../../src/model/snapshot/RichText.js";

/** A pack-shaped pick row with markdown in its option labels (possession gear lists do this). */
const pickEntry = {
	slug: "weapons",
	list: [{
		type: "pick",
		options: [
			{ slug: "sword", text: "◇ Sword, iron (*close*, +1 damage)" },
			{ slug: "axe",   content: { title: "◇ Battleaxe (*close, messy*)" } },
		],
	}],
};

describe("buildChoiceGroup pick rows — option labels are rich text", () => {
	const options = () => buildChoiceGroup(pickEntry, new ChoiceValues()).list[0].options;

	it("wraps an option's `text` in a RichText", () => {
		expect(options()[0].text).toBeInstanceOf(RichText);
	});

	it("renders markdown emphasis in the label instead of literal asterisks", () => {
		expect(options()[0].text.render()).toBe("◇ Sword, iron (<em>close</em>, +1 damage)");
	});

	it("wraps a `content.title` label too", () => {
		expect(options()[1].text.render()).toBe("◇ Battleaxe (<em>close, messy</em>)");
	});

	// `raw` is the stored markdown: what a write-in box shows, and what the condensed view joins
	// into a line. Rendering is `render()`'s job.
	it("keeps the source markdown on `raw`", () => {
		expect(options()[0].text.raw).toBe("◇ Sword, iron (*close*, +1 damage)");
	});

	it("gives an option with no label an empty RichText rather than null", () => {
		const group = buildChoiceGroup({ slug: "g", list: [{ type: "pick", options: [{ slug: "a" }] }] });
		expect(group.list[0].options[0].text.raw).toBe("");
	});
});

describe("buildChoiceGroup — optional section title", () => {
	it("carries a group-level `title` through to the ChoiceGroup (the Codex's 'Spells of the Codex')", () => {
		const group = buildChoiceGroup({ slug: "spells", title: "Spells of the Codex", list: [] });
		expect(group.title).toBe("Spells of the Codex");
	});
	it("defaults `title` to null when the group def has none (follower groups)", () => {
		expect(buildChoiceGroup({ slug: "g", list: [] }).title).toBeNull();
	});
});

describe("buildChoiceGroup — the Lightbearer's write-in origin", () => {
	const lightbearer = JSON.parse(fs.readFileSync(
		path.join(process.cwd(), "packs/src/playbooks/the-lightbearer.json"), "utf8"));
	const origin = lightbearer.system.choices.find(g => g.slug === "helior-powers-origin");
	const row    = () => buildChoiceGroup(origin, new ChoiceValues()).list.find(r => r.slug === "first-sight");

	// The last "You Came Into Your Powers…" option is open-ended, so it needs somewhere to write the
	// answer — the same inline box the Judge's intro questions use.
	it("gives the open-ended option an inline write-in box", () => {
		expect(row().input).toMatchObject({ slug: "first-sight-input", type: "inline", value: "" });
	});

	it("keeps the printed blank in the label instead of bolding the line", () => {
		expect(row().content.text.render()).toBe("… when you first laid eyes upon the _______.");
	});
});

// A blank that answers the row's first sentence (a Terrible Purpose's "Name the person…") is drawn
// straight after it, not under the whole text; the pack says so with `input.follows: "lead"`.
describe("buildChoiceGroup — a blank that follows the lead", () => {
	const LONGING = { type: "entry", slug: "longing", track: { max: 1 },
		content: { text: "**LONGING** — Name them.\n\nWhen you watch them, heal." } };
	const row = (input, values = {}) =>
		buildChoiceGroup({ slug: "terrible-purpose", list: [{ ...LONGING, input }] }, new ChoiceValues(values)).list[0];

	it("builds the row's blank as an EntryInput", () => {
		const input = row({ type: "inline", follows: "lead" }, { "terrible-purpose": { "longing-input": "Mira" } }).input;
		expect(input).toBeInstanceOf(EntryInput);
		expect(input).toMatchObject({ slug: "longing-input", type: "inline", value: "Mira", followsLead: true });
	});

	it("splits the text into the lead the blank follows and the rest", () => {
		const { content } = row({ type: "inline", follows: "lead" });
		expect([content.lead.raw, content.rest.raw]).toEqual(["**LONGING** — Name them.", "When you watch them, heal."]);
		expect(content.text.raw).toBe(LONGING.content.text);
	});

	it("leaves a blank that does not say so at the end of the row, and the text whole", () => {
		const r = row({ type: "inline" });
		expect(r.input.followsLead).toBe(false);
		expect([r.content.lead, r.content.rest]).toEqual([null, null]);
	});
});

describe("EntryInput", () => {
	it("reads its value from the store, else the pack's default", () => {
		const values = new ChoiceValues({ g: { "a-input": "typed" } });
		expect(EntryInput.fromPack({ slug: "a", input: { default: "d" } }, values, "g").value).toBe("typed");
		expect(EntryInput.fromPack({ slug: "a", input: { default: "d" } }, new ChoiceValues(), "g").value).toBe("d");
	});

	it("is a one-line blank at the row's end unless the pack says otherwise", () => {
		const input = EntryInput.fromPack({ slug: "a", input: {} }, new ChoiceValues(), "g");
		expect([input.slug, input.type, input.placeholder, input.followsLead]).toEqual(["a-input", "inline", null, false]);
	});

	it("follows the lead only for `follows: \"lead\"`", () => {
		const input = follows => EntryInput.fromPack({ slug: "a", input: { follows } }, new ChoiceValues(), "g").followsLead;
		expect([input("lead"), input("end"), input(undefined)]).toEqual([true, false, false]);
	});
});

describe("ChoiceGroup's two facts about itself", () => {
	const def = { slug: "worship", list: [
		{ type: "entry", content: { title: "Praise the day", text: "Answer." } },
		{ type: "pick", pickCount: 1, options: [{ slug: "dawn", text: "dawn" }, { slug: "dusk", text: "dusk" }] },
	] };

	it("says whether it offers anything to choose", () => {
		expect(buildChoiceGroup(def, new ChoiceValues()).offersChoice).toBe(true);
		expect(buildChoiceGroup({ slug: "collection", list: [def.list[0]] }, new ChoiceValues()).offersChoice).toBe(false);
	});

	it("says whether anything in it has been chosen", () => {
		expect(buildChoiceGroup(def, new ChoiceValues()).hasChosen).toBe(false);
		expect(buildChoiceGroup(def, new ChoiceValues({ worship: { dawn: 1 } })).hasChosen).toBe(true);
	});
});
