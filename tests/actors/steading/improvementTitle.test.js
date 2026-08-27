import { describe, expect, it } from "vitest";
import { SteadingImprovement } from "../../../src/actors/steading/repositories/FoundrySteadingImprovementRepository.js";
import { buildChoiceGroup } from "../../../src/model/snapshot/character/buildChoiceGroup.js";
import { renderPartial } from "../../fakes/renderTemplate.js";

// An improvement's name used to be repeated into its first row's title, so the steading panel had
// something to show. The name is the single source now, carried through as the group's title.

const improvement = (name = "Weapons of War") => new SteadingImprovement("weapons-of-war", name, {
	slug: "weapons-of-war",
	list: [
		{ type: "entry", content: { title: null, text: "Requires all of the following:" } },
		{ type: "entry", slug: "buy-weapons", content: { title: null, text: "Buy weapons." }, track: { max: 1 } },
	],
});

describe("SteadingImprovement#titledChoices", () => {
	it("titles the choice group with the improvement's own name", () => {
		expect(improvement().titledChoices.title).toBe("Weapons of War");
	});

	it("leaves the rest of the group untouched", () => {
		const titled = improvement().titledChoices;
		expect(titled.slug).toBe("weapons-of-war");
		expect(titled.list).toHaveLength(2);
	});

	it("does not mutate the underlying choices", () => {
		const imp = improvement();
		imp.titledChoices;
		expect(imp.choices.title).toBeUndefined();
	});

	// A pack entry with no content yet is skipped rather than rendered blank.
	it("is null when the improvement has no choices", () => {
		expect(new SteadingImprovement("mill", "Mill", null).titledChoices).toBeNull();
	});
});

describe("improvement-group rendering", () => {
	const render = imp => renderPartial("stonetop.improvement-group", buildChoiceGroup(imp.titledChoices));

	it("shows the improvement's name once, as the panel's title", () => {
		const html = render(improvement());
		expect(html.match(/Weapons of War/gu)).toHaveLength(1);
		expect(html).toContain('<p class="stonetop-choice-entry-title">Weapons of War</p>');
	});

	it("still renders the rows beneath it", () => {
		const html = render(improvement());
		expect(html).toContain("Requires all of the following:");
		expect(html).toContain("Buy weapons.");
	});

	// The improvement ITEM sheet passes no title, because its window header already names it.
	it("renders no title when none is supplied", () => {
		const untitled = buildChoiceGroup(improvement().choices);
		const html = renderPartial("stonetop.improvement-group", untitled);
		expect(html).not.toContain("stonetop-choice-entry-title");
		expect(html).toContain("Buy weapons.");
	});
});
