import { describe, it, expect } from "vitest";
import { RosterText } from "../../../src/actors/steading/RosterText.js";

describe("RosterText.normalize", () => {
	it("lowercases", () => {
		expect(RosterText.normalize("Cheery")).toBe("cheery");
	});

	it("flattens every run of punctuation and whitespace to one space", () => {
		expect(RosterText.normalize("- Cheery;  all   thumbs.")).toBe("cheery all thumbs");
	});

	it("reads a hyphenated trait and a spaced one as the same thing", () => {
		expect(RosterText.normalize("eagle-eye")).toBe(RosterText.normalize("eagle eye"));
	});

	it("reads an apostrophe as no apostrophe", () => {
		expect(RosterText.normalize("doesn't pull their weight"))
			.toBe(RosterText.normalize("doesnt pull their weight"));
	});

	it("is empty for nothing", () => {
		expect(RosterText.normalize("")).toBe("");
		expect(RosterText.normalize(null)).toBe("");
		expect(RosterText.normalize(undefined)).toBe("");
	});
});

describe("RosterText.mentions", () => {
	it("finds a phrase written alone", () => {
		expect(RosterText.mentions("cheery", "cheery")).toBe(true);
	});

	// The reason there is no tokenising: whatever the table wrote between them, the traits are found.
	it.each([
		["cheery mute",   "spaces"],
		["cheery, mute",  "commas"],
		["cheery; mute",  "semicolons"],
		["cheery\nmute",  "newlines"],
		["Cheery. Mute.", "sentences"],
		["- cheery\n- mute", "bullets"],
	])("finds both traits in %j, written with %s", written => {
		expect(RosterText.mentions(written, "cheery")).toBe(true);
		expect(RosterText.mentions(written, "mute")).toBe(true);
	});

	it("finds a multi-word trait inside a longer line", () => {
		expect(RosterText.mentions("cheery and knows all the gossip", "knows all the gossip")).toBe(true);
	});

	it("matches whole phrases, not pieces of words", () => {
		expect(RosterText.mentions("commuted to Marshedge", "mute")).toBe(false);
	});

	// The overlap that comes with reading a cell as a sentence, stated so a change to it is deliberate.
	it("finds a short trait inside a longer phrase containing it", () => {
		expect(RosterText.mentions("blind drunk", "blind")).toBe(true);
	});

	it("is false for a blank needle", () => {
		expect(RosterText.mentions("cheery", "")).toBe(false);
		expect(RosterText.mentions("cheery", null)).toBe(false);
	});

	it("is false against a blank haystack", () => {
		expect(RosterText.mentions("", "cheery")).toBe(false);
		expect(RosterText.mentions(null, "cheery")).toBe(false);
	});
});

describe("RosterText.same", () => {
	it("ignores case and trailing punctuation", () => {
		expect(RosterText.same("Bryn,", "bryn")).toBe(true);
	});

	it("is false for different values", () => {
		expect(RosterText.same("Bryn", "Cadoc")).toBe(false);
	});

	// Unlike mentions: a name cell holds one name, so Bryn is not Bryn the Baker.
	it("is false when one merely contains the other", () => {
		expect(RosterText.same("Bryn the Baker", "Bryn")).toBe(false);
	});

	it("is false when either side is blank", () => {
		expect(RosterText.same("", "")).toBe(false);
		expect(RosterText.same("Bryn", "")).toBe(false);
		expect(RosterText.same(null, "Bryn")).toBe(false);
	});
});
