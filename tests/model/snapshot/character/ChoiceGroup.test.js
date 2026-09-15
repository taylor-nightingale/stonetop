import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ChoiceValues } from "../../../../src/model/snapshot/character/ChoiceGroup.js";
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
