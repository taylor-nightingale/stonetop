import { describe, it, expect } from "vitest";
import {
	BackgroundSection, BackgroundOptionSnapshotBuilder,
} from "../../../../src/model/snapshot/character/PlaybookSnapshot.js";
import { buildChoiceGroup } from "../../../../src/model/snapshot/character/buildChoiceGroup.js";

const option = (slug, choices = null) => new BackgroundOptionSnapshotBuilder()
	.withSlug(slug).withLabel(slug).withDescription("").withSelected(false)
	.withMoves([]).withChoices(choices).build();

const group = (slug, list = []) => buildChoiceGroup({ slug, list });

describe("BackgroundSection#choiceGroups", () => {
	// The UNCHOSEN options too, and that is the whole point of the getter: the tab draws every
	// background because reading them is how a player picks one, and each background's group names the
	// moves and followers it gives you. Collected from the selected option alone, the rest resolve to
	// nothing and their rows render empty — which is exactly the choice the reader was trying to make.
	it("gathers every option's group, chosen or not", () => {
		const section = new BackgroundSection("the-natural", [
			option("the-natural", group("the-natural")),
			option("the-scoundrel", group("the-scoundrel")),
		]);
		expect(section.choiceGroups.map(g => g.slug)).toEqual(["the-natural", "the-scoundrel"]);
	});

	// A background with nothing to choose carries no group at all — most of them.
	it("skips an option with no group", () => {
		const section = new BackgroundSection(null, [
			option("plain"),
			option("the-scoundrel", group("the-scoundrel")),
		]);
		expect(section.choiceGroups.map(g => g.slug)).toEqual(["the-scoundrel"]);
	});

	it("is empty for a playbook with no backgrounds", () => {
		expect(new BackgroundSection(null, []).choiceGroups).toEqual([]);
	});
});
