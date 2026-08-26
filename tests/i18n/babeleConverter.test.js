import { describe, expect, it } from "vitest";
import { CONVERTER_NAME, stonetopMapping, stonetopStringsConverter } from "../../src/i18n/babeleConverter.js";

const seeker = () => ({
	_id: "abc123",
	type: "playbook",
	name: "The Seeker",
	system: {
		slug: "the-seeker",
		description: "Look at us.",
		statsNote: "+2, +1",
		backgrounds: [
			{ slug: "patriot", label: "Patriot", description: "These people are family." },
			{ slug: "antiquarian", label: "Antiquarian", description: "Secrets." },
		],
		choices: [{ slug: "arcana-major", list: [
			{ slug: "where-acquired", content: { text: "Where did you acquire it?" } },
		] }],
		moves: ["well-versed"],
	},
});

const GERMAN = {
	"description": "Seht uns an.",
	"backgrounds/patriot/description": "Diese Leute sind Familie.",
	"choices/arcana-major/where-acquired/text": "Wo hast du es erworben?",
};

const translate = (doc, fragment) => stonetopStringsConverter(doc.system, fragment, doc);

describe("stonetopStringsConverter", () => {
	it("returns a system object with the mapped prose translated", () => {
		const result = translate(seeker(), GERMAN);
		expect(result.description).toBe("Seht uns an.");
		expect(result.backgrounds[0].description).toBe("Diese Leute sind Familie.");
		expect(result.choices[0].list[0].content.text).toBe("Wo hast du es erworben?");
	});

	// Babele rebuilds the document from what converters return; mutating its input would leak the
	// active language into data other readers still hold.
	it("never mutates the source data Babele handed it", () => {
		const doc = seeker();
		translate(doc, GERMAN);
		expect(doc.system.description).toBe("Look at us.");
		expect(doc.system.backgrounds[0].description).toBe("These people are family.");
	});

	it("leaves untranslated strings and all structure alone", () => {
		const result = translate(seeker(), GERMAN);
		expect(result.statsNote).toBe("+2, +1");
		expect(result.backgrounds[1].description).toBe("Secrets.");
		expect(result.slug).toBe("the-seeker");
		expect(result.backgrounds[0].slug).toBe("patriot");
		expect(result.moves).toEqual(["well-versed"]);
	});

	it("addresses rows by slug, so reordering the source does not shift translations", () => {
		const doc = seeker();
		doc.system.backgrounds.reverse();
		const result = translate(doc, GERMAN);
		expect(result.backgrounds[1].description).toBe("Diese Leute sind Familie.");
		expect(result.backgrounds[0].description).toBe("Secrets.");
	});

	it("ignores the name entry, which Babele maps on its own", () => {
		const result = translate(seeker(), { ...GERMAN, name: "Der Sucher" });
		expect(result.name).toBeUndefined();
	});

	it("skips blank and non-string translations", () => {
		const result = translate(seeker(), { description: "   ", statsNote: 7 });
		expect(result.description).toBe("Look at us.");
		expect(result.statsNote).toBe("+2, +1");
	});

	// Babele treats undefined as "nothing to merge", which leaves the English in place.
	it("returns undefined when there is nothing to apply", () => {
		expect(stonetopStringsConverter(seeker().system, null, seeker())).toBeUndefined();
		expect(stonetopStringsConverter(null, GERMAN, seeker())).toBeUndefined();
		expect(stonetopStringsConverter(seeker().system, "nope", seeker())).toBeUndefined();
	});

	it("leaves a document of an untranslated type untouched", () => {
		const move = { _id: "x", type: "move", name: "Defy Danger", system: { slug: "defy-danger", description: "When you..." } };
		expect(translate(move, { description: "Wenn du..." }).description).toBe("When you...");
	});
});

describe("stonetopMapping", () => {
	it("maps name directly and hands system to the converter", () => {
		expect(stonetopMapping()).toEqual({
			name: "name",
			stonetop: { path: "system", converter: CONVERTER_NAME },
		});
	});
});
