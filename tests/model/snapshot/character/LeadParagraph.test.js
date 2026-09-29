import { describe, it, expect } from "vitest";
import { LeadParagraph } from "../../../../src/model/snapshot/character/LeadParagraph.js";

// An entry whose blank answers its first sentence — a Terrible Purpose's "Name the person or persons
// you refuse to let go of." — is drawn as that paragraph, the blank, then the paragraphs after it.

describe("LeadParagraph.of", () => {
	it("splits the first paragraph from the rest at the first blank line", () => {
		const p = LeadParagraph.of("**LONGING** — Name them.\n\nWhen you watch them, heal.\n\nWhen they die, so do you.");
		expect([p.lead, p.rest]).toEqual(["**LONGING** — Name them.", "When you watch them, heal.\n\nWhen they die, so do you."]);
	});

	it("takes a whole text of one paragraph as the lead, with nothing after it", () => {
		const p = LeadParagraph.of("Name them.");
		expect([p.lead, p.rest]).toEqual(["Name them.", ""]);
	});

	// A single line break is inside a paragraph, not between two.
	it("keeps a single line break inside the lead", () => {
		expect(LeadParagraph.of("Name them,\nall of them.\n\nThen heal.").lead).toBe("Name them,\nall of them.");
	});

	it("reads a blank line with spaces in it as a paragraph break", () => {
		expect(LeadParagraph.of("Name them. \n \nThen heal.").rest).toBe("Then heal.");
	});

	it("gives empty text an empty lead and rest", () => {
		const p = LeadParagraph.of(null);
		expect([p.lead, p.rest]).toEqual(["", ""]);
	});
});
