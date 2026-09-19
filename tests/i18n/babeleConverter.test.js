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

// What Babele does with the payload: merge it over the document it was translating. The tests below
// that reason about an embedded copy apply the payload the same way, because that is the only way
// the return value is ever used.
const merged = (system, payload) => ({ ...system, ...(payload ?? {}) });

describe("stonetopStringsConverter", () => {
	it("translates the mapped prose", () => {
		const result = translate(seeker(), GERMAN);
		expect(result.description).toBe("Seht uns an.");
		expect(result.backgrounds[0].description).toBe("Diese Leute sind Familie.");
		expect(result.choices[0].list[0].content.text).toBe("Wo hast du es erworben?");
	});

	// Babele rebuilds the document from what converters return, so mutating its input would leak the
	// active language into data other readers still hold.
	it("never mutates the source data Babele handed it", () => {
		const doc = seeker();
		translate(doc, GERMAN);
		expect(doc.system.description).toBe("Look at us.");
		expect(doc.system.backgrounds[0].description).toBe("These people are family.");
	});

	it("names only the subtrees it translated, so a merge leaves everything else standing", () => {
		const result = translate(seeker(), GERMAN);
		expect(Object.keys(result).sort()).toEqual(["backgrounds", "choices", "description"]);
		// Untranslated siblings are absent from the payload rather than restated from the source.
		expect(result).not.toHaveProperty("statsNote");
		expect(result).not.toHaveProperty("slug");
		expect(result).not.toHaveProperty("moves");
		// …and so survive the merge untouched.
		const system = merged(seeker().system, result);
		expect(system.statsNote).toBe("+2, +1");
		expect(system.slug).toBe("the-seeker");
		expect(system.moves).toEqual(["well-versed"]);
	});

	// A merge replaces an array wholesale, so an array that holds a translated string has to be
	// handed back entire — including the rows that were not translated.
	it("carries a whole array when a string inside it is translated", () => {
		const result = translate(seeker(), GERMAN);
		expect(result.backgrounds).toHaveLength(2);
		expect(result.backgrounds[1].description).toBe("Secrets.");
		expect(result.backgrounds[0].label).toBe("Patriot");
		expect(result.backgrounds[0].slug).toBe("patriot");
	});

	it("addresses rows by slug, so reordering the source does not shift translations", () => {
		const doc = seeker();
		doc.system.backgrounds.reverse();
		const result = translate(doc, GERMAN);
		expect(result.backgrounds[1].description).toBe("Diese Leute sind Familie.");
		expect(result.backgrounds[0].description).toBe("Secrets.");
	});

	it("reaches a leaf under a plain object without dragging its siblings in", () => {
		const move = {
			_id: "m1", type: "move", name: "Bolster",
			system: {
				slug: "bolster",
				moveResults: {
					success: { label: "10+", value: "Take 3." },
					partial: { label: "7-9", value: "Take 1." },
				},
			},
		};
		const result = translate(move, { "moveResults/success/value": "Nimm 3." });
		expect(result.moveResults.success.value).toBe("Nimm 3.");
		// The dice notation beside it, and the tier that was not translated, are not named at all.
		expect(result.moveResults.success).not.toHaveProperty("label");
		expect(result.moveResults).not.toHaveProperty("partial");
	});

	it("ignores the name entry, which Babele maps on its own", () => {
		const result = translate(seeker(), { ...GERMAN, name: "Der Sucher" });
		expect(result).not.toHaveProperty("name");
	});

	it("skips blank and non-string translations", () => {
		expect(translate(seeker(), { description: "   ", statsNote: 7 })).toBeUndefined();
	});

	// Babele treats undefined as "nothing to merge", which leaves the English in place. An empty
	// object would instead count as a translation and stamp the document as translated.
	it("returns undefined when there is nothing to apply", () => {
		expect(stonetopStringsConverter(seeker().system, null, seeker())).toBeUndefined();
		expect(stonetopStringsConverter(null, GERMAN, seeker())).toBeUndefined();
		expect(stonetopStringsConverter(seeker().system, "nope", seeker())).toBeUndefined();
		expect(translate(seeker(), { "backgrounds/nobody/description": "Niemand." })).toBeUndefined();
	});

	it("leaves a document of an untranslated type untouched", () => {
		const npc = { _id: "x", type: "npc", name: "Nerth serpent", system: { slug: "nerth-serpent", description: "A great serpent." } };
		expect(translate(npc, { description: "Eine große Schlange." })).toBeUndefined();
	});
});

// Babele's actor-item translation merges this same payload onto an embedded COPY of a pack document.
// That copy carries the player's own state in `system` beside the pack's prose, and the pack
// document it is translated from carries only that field's blank initial — so anything the payload
// names that the player owns is overwritten with a blank. Nothing may be named but prose.
describe("stonetopStringsConverter, applied to an embedded copy", () => {
	const packMove = () => ({
		_id: "mv", type: "move", name: "Bolster",
		system: {
			slug: "bolster", description: "When you bolster…", moveType: "basic",
			// What a pack move carries for the fields a character's copy owns.
			categoryKey: null, categoryLabel: null, categoryNote: null, compendiumId: null,
			acquired: false, instanceCount: 0, sortOrder: null, pickValues: {},
		},
	});

	const ownedMove = () => ({
		...packMove().system,
		categoryKey: "basic", categoryLabel: "Basic Moves", categoryNote: "Everyone has these.",
		compendiumId: "68E7jbfb3AvXJQtl", acquired: true, instanceCount: 1, sortOrder: 3,
		pickValues: { "bolster-what": { picked: ["readiness"] } },
	});

	it("leaves a move's category and acquisition alone", () => {
		const system = merged(ownedMove(), translate(packMove(), { description: "Wenn du dich vorbereitest…" }));
		expect(system.description).toBe("Wenn du dich vorbereitest…");
		expect(system.categoryKey).toBe("basic");
		expect(system.categoryLabel).toBe("Basic Moves");
		expect(system.categoryNote).toBe("Everyone has these.");
		expect(system.compendiumId).toBe("68E7jbfb3AvXJQtl");
		expect(system.acquired).toBe(true);
		expect(system.instanceCount).toBe(1);
		expect(system.sortOrder).toBe(3);
		expect(system.pickValues).toEqual({ "bolster-what": { picked: ["readiness"] } });
	});

	it("leaves a possession selected, and keeps the playbook that granted it", () => {
		const pack = {
			_id: "p", type: "possession", name: "Herb garden",
			system: { slug: "herb-garden", description: "A garden.", selected: false, preselected: false, playbookSlug: null },
		};
		const owned = { ...pack.system, selected: true, preselected: true, playbookSlug: "the-blessed" };
		const system = merged(owned, translate(pack, { description: "Ein Garten." }));
		expect(system.description).toBe("Ein Garten.");
		// outfitGrantFor is gated on `selected`: losing it silently takes the gear with it.
		expect(system.selected).toBe(true);
		expect(system.preselected).toBe(true);
		expect(system.playbookSlug).toBe("the-blessed");
	});

	it("leaves a follower owned, at the hit points it has", () => {
		const pack = {
			_id: "f", type: "follower", name: "Acolyte",
			system: { slug: "acolyte", description: "A follower.", owned: false, hp: { value: 0, max: 6 } },
		};
		const owned = { ...pack.system, owned: true, hp: { value: 2, max: 6 } };
		const system = merged(owned, translate(pack, { description: "Ein Gefolgsmann." }));
		expect(system.description).toBe("Ein Gefolgsmann.");
		expect(system.owned).toBe(true);
		expect(system.hp).toEqual({ value: 2, max: 6 });
	});

	it("leaves a playbook's chosen backgrounds alone", () => {
		const pack = seeker();
		pack.system.backgroundValues = {};
		const owned = { ...pack.system, backgroundValues: { patriot: { picked: ["kin"] } } };
		const system = merged(owned, translate(pack, GERMAN));
		expect(system.backgrounds[0].description).toBe("Diese Leute sind Familie.");
		expect(system.backgroundValues).toEqual({ patriot: { picked: ["kin"] } });
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
