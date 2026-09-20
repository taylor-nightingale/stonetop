import { describe, it, expect } from "vitest";
import { DebilitySnapshotBuilder } from "../../src/model/snapshot/character/DebilitySnapshot.js";

/**
 * What a debility says about itself, and the short form of it.
 *
 * The book writes each description as two sentences — what the debility IS, then which rolls it
 * hinders. The band has room for neither (it is one line of bracket art, and the sentence lives
 * clipped for assistive tech); the masthead's folded strip has room for one, and the one worth
 * printing is the first: the clause naming the stats is already said by those stats' numbers turning
 * red on the line directly below it.
 */
const debility = description => new DebilitySnapshotBuilder()
	.withKey("dazed").withName("dazed").withStats(["int", "wis"])
	.withDescription(description).build();

describe("a debility's summary", () => {
	it("is the first sentence of its description", () => {
		expect(debility("Out of it, befuddled, not thinking clearly. Take disadvantage when rolling +INT or +WIS.").summary)
			.toBe("Out of it, befuddled, not thinking clearly.");
	});

	// A translation is free to write one sentence, and a description that is already short is already
	// the summary — there is nothing to cut and nothing to fail on.
	it("is the whole description when there is only one sentence", () => {
		expect(debility("Take disadvantage when rolling +INT or +WIS.").summary)
			.toBe("Take disadvantage when rolling +INT or +WIS.");
		expect(debility("Befuddled").summary).toBe("Befuddled");
	});

	// Three sentences cut at the first, not the last.
	it("keeps only the first of several", () => {
		expect(debility("One. Two. Three.").summary).toBe("One.");
	});

	// A decimal, an abbreviation or a "+1." mid-sentence is a full stop with no space after it, which
	// is why the cut looks for the SPACE as well: "p.53" is not the end of anything.
	it("does not cut at a full stop inside a word", () => {
		expect(debility("See p.53 for this one. Take disadvantage.").summary)
			.toBe("See p.53 for this one.");
	});

	it("says nothing when the description does", () => {
		expect(new DebilitySnapshotBuilder().withKey("dazed").build().summary).toBe("");
	});
});
