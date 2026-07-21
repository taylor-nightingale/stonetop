import { describe, it, expect } from "vitest";
import { ChoiceGroup, ChoiceValues } from "../../../../src/model/snapshot/character/ChoiceGroup.js";
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

describe("ChoiceGroup.buildPickRow — option labels are rich text", () => {
	const options = () => ChoiceGroup.fromPackData(pickEntry, new ChoiceValues()).list[0].options;

	it("wraps an option's `text` in a RichText", () => {
		expect(options()[0].text).toBeInstanceOf(RichText);
	});

	it("renders markdown emphasis in the label instead of literal asterisks", () => {
		expect(options()[0].text.render()).toBe("◇ Sword, iron (<em>close</em>, +1 damage)");
	});

	it("wraps a `content.title` label too", () => {
		expect(options()[1].text.render()).toBe("◇ Battleaxe (<em>close, messy</em>)");
	});

	it("keeps the source markdown on `raw` — the display-label mirror writes raw into a text box", () => {
		expect(options()[0].text.raw).toBe("◇ Sword, iron (*close*, +1 damage)");
	});

	it("gives an option with no label an empty RichText rather than null", () => {
		const group = ChoiceGroup.fromPackData({ slug: "g", list: [{ type: "pick", options: [{ slug: "a" }] }] });
		expect(group.list[0].options[0].text.raw).toBe("");
	});
});
