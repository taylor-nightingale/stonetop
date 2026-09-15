import { describe, expect, it } from "vitest";
import { migrateSteadingShape } from "../../src/migration/migrateSteadingShape.js";
import { SteadingData } from "../../src/data/SteadingData.js";

// A pre-0.13.0 steading SOURCE: ratings stored as INDICES into [-1,0,1,2,3] inside {current, items}
// objects, size as an index, fortunes/surplus at the system root, resources/fortifications inside
// attributes.*.items, places as bare strings, resident pool in residentNames/residentTraits, people
// in `residents`, pick state in improvements.pickValues. Without healing, this source fails
// NumberField validation at world init and the actor is quarantined.
function legacySource() {
	return {
		fortunes: 2,   // index → +1
		surplus:  1,
		attributes: {
			size:       { current: 1, items: [] },                        // → "village"
			population: { current: 1, items: [] },                        // → +0
			prosperity: { current: 3, items: ["Farming", "Distilling"] }, // → +2, resources
			defenses:   { current: 0, items: ["Village militia"] },       // → -1, fortifications
		},
		assets: { items: ["A wagon"], coinage: [{ title: "silver", purses: 0, handfuls: 0, coins: 0 }] },
		placesOfInterest: ["The Stone", "The Granary"],
		residentNames: "Aderyn, Bryn",
		residentTraits: ["curious", "stoic"],
		residents: [{ id: "1", name: "Afon" }],
		improvements: { pickValues: { market: { offer: 1 } } },
		debilities: { diminished: true, lacking: false, malcontent: false },
	};
}

describe("migrateSteadingShape — legacy full source", () => {
	it("converts ratings from indices to actual values and size to its tier", () => {
		const src = migrateSteadingShape(legacySource());
		expect(src.attributes).toMatchObject({
			fortunes: 1, surplus: 1, size: "village", population: 0, prosperity: 2, defenses: -1,
		});
		expect(src.fortunes).toBeUndefined();   // moved off the root
		expect(src.surplus).toBeUndefined();
	});

	it("moves the resource/fortification lists into assets without clobbering existing assets", () => {
		const src = migrateSteadingShape(legacySource());
		expect(src.assets.resources).toEqual(["Farming", "Distilling"]);
		expect(src.assets.fortifications).toEqual(["Village militia"]);
		expect(src.assets.coinage[0].title).toBe("silver");
	});

	it("reshapes string places to objects", () => {
		const src = migrateSteadingShape(legacySource());
		expect(src.placesOfInterest).toEqual([
			{ name: "The Stone", linkUuid: "" },
			{ name: "The Granary", linkUuid: "" },
		]);
	});

	it("folds the resident pool + people into their new fields", () => {
		const src = migrateSteadingShape(legacySource());
		expect(src.residents).toEqual({ names: "Aderyn, Bryn", traits: ["curious", "stoic"] });
		expect(src.folk).toEqual([{ home: "", id: "1", name: "Afon" }]);
		expect(src.residentNames).toBeUndefined();
		expect(src.residentTraits).toBeUndefined();
	});

	it("gives every asset a requisitioned state", () => {
		const src = migrateSteadingShape(legacySource());
		expect(src.assets.items).toEqual([{ text: "A wagon", requisitioned: false }]);
	});

	it("turns legacy pick state into improvementValues and empties the slug list for the runner", () => {
		const src = migrateSteadingShape(legacySource());
		expect(src.improvements).toEqual([]);
		expect(src.improvementValues).toEqual({ market: { offer: 1 } });
	});

	it("falls back for out-of-range or missing indices", () => {
		const src = migrateSteadingShape({
			attributes: { size: {}, population: { current: 99 }, prosperity: {}, defenses: { current: -2 } },
		});
		expect(src.attributes.size).toBe("village");   // old attrField initial current: 1
		expect(src.attributes.population).toBe(0);
		expect(src.attributes.prosperity).toBe(0);     // current ?? 1 → +0
		expect(src.attributes.defenses).toBe(0);
	});
});

describe("migrateSteadingShape — current-shape sources and update diffs (must be untouched)", () => {
	it("leaves a healed full source alone", () => {
		const modern = {
			steadfast: "stonetop",
			attributes: { fortunes: 1, surplus: 1, size: "village", population: 0, prosperity: 2, defenses: -1 },
			assets: { items: [{ text: "A wagon", requisitioned: true }], resources: ["Farming"], fortifications: [], coinage: [] },
			placesOfInterest: [{ name: "The Stone", linkUuid: "" }],
			residents: { names: "", traits: [] },
			folk: [],
			improvements: ["market"],
			improvementValues: { market: { offer: 1 } },
		};
		const src = migrateSteadingShape(structuredClone(modern));
		expect(src).toEqual(modern);
	});

	it("passes a partial update diff through unchanged, injecting nothing", () => {
		// Foundry re-runs migrateData on the {changed-keys} diff of every update — defaulting an
		// absent field here would clobber stored values on every edit.
		const diff = { attributes: { population: 2 } };
		expect(migrateSteadingShape(structuredClone(diff))).toEqual(diff);

		const notesDiff = { notes: "new note" };
		expect(migrateSteadingShape(structuredClone(notesDiff))).toEqual(notesDiff);
	});
});

describe("SteadingData.migrateData", () => {
	it("routes sources through the shape heal before validation", () => {
		const healed = SteadingData.migrateData({ attributes: { population: { current: 3, items: [] } } });
		expect(healed.attributes.population).toBe(2);
	});
});

// Residents and neighbours were two arrays rendering the same table. The fold is where they become
// one roster, and it is also the only place that can still SEE the retired keys: Foundry's schema
// cleaning strips an undeclared key from the in-memory source before anything else runs.
describe("migrateSteadingShape — the roster merge", () => {
	it("merges residents and neighbours into one roster, residents first", () => {
		const src = migrateSteadingShape({
			residentPeople: [{ id: "1", name: "Bryn" }],
			neighborPeople: [{ id: "2", name: "Seadha", home: "Marshedge" }],
		});
		expect(src.folk.map(p => p.name)).toEqual(["Bryn", "Seadha"]);
		expect(src.residentPeople).toBeUndefined();
		expect(src.neighborPeople).toBeUndefined();
	});

	// Blank is not "unknown" — it is this steading, which is what lets one column carry the difference.
	it("gives a resident a blank home and leaves a neighbour's alone", () => {
		const src = migrateSteadingShape({
			residentPeople: [{ id: "1", name: "Bryn" }],
			neighborPeople: [{ id: "2", name: "Seadha", home: "Marshedge" }],
		});
		expect(src.folk.map(p => p.home)).toEqual(["", "Marshedge"]);
	});

	// A client that loads a legacy steading and saves anything writes the MERGED roster while the old
	// keys are still in the database; a straight concat on the next load would double every neighbour.
	it("does not re-add someone the merged roster already holds", () => {
		const src = migrateSteadingShape({
			folk: [{ id: "1", name: "Bryn", home: "" }, { id: "2", name: "Seadha", home: "Marshedge" }],
			residentPeople: [{ id: "1", name: "Bryn" }],
			neighborPeople: [{ id: "2", name: "Seadha", home: "Marshedge" }],
		});
		expect(src.folk.map(p => p.id)).toEqual(["1", "2"]);
	});

	// The very old flag-based people had no ids at all, and the sheet addresses every row by one.
	it("stamps an id onto a legacy row that has none", () => {
		const src = migrateSteadingShape({ residentPeople: [{ name: "Bryn" }] });
		expect(src.folk[0].id).toBeTruthy();
	});

	it("folds an empty neighbour list without inventing anything", () => {
		const src = migrateSteadingShape({ residentPeople: [], neighborPeople: [] });
		expect(src.folk).toEqual([]);
	});

	it("leaves a diff that carries neither key alone", () => {
		const diff = { folk: [{ id: "1", name: "Bryn", home: "" }] };
		expect(migrateSteadingShape(structuredClone(diff))).toEqual(diff);
	});
});

describe("migrateSteadingShape — assets get a state", () => {
	it("turns a bare sentence into an asset that is at home", () => {
		const src = migrateSteadingShape({ assets: { items: ["A wagon", "A cart"] } });
		expect(src.assets.items).toEqual([
			{ text: "A wagon", requisitioned: false },
			{ text: "A cart", requisitioned: false },
		]);
	});

	it("leaves an asset that already has a state alone", () => {
		const items = [{ text: "A wagon", requisitioned: true }];
		expect(migrateSteadingShape({ assets: { items } }).assets.items).toEqual(items);
	});

	// `toBeUndefined` was what this asserted, and it passed for a year while the heal wrote
	// `assets: undefined` into every diff that had no assets — an absent key and a key holding
	// undefined are indistinguishable to it, and only one of the two is harmless. The key itself is
	// what matters: Foundry resets a SchemaField given an explicit undefined, so the injected key
	// cleared the resource and fortification lists on every unrelated edit.
	it("does not so much as MENTION assets when the diff carries none", () => {
		expect(migrateSteadingShape({ notes: "x" })).not.toHaveProperty("assets");
	});
});

// Step 9: the content page's three free-text boxes became three lists, so what a table typed into one
// has to arrive as entries rather than be dropped on the floor with the field.
describe("migrateSteadingShape — the content boxes become lists", () => {
	const legacyContent = (content) => migrateSteadingShape({ content }).content;

	it("makes one entry per line of what was typed", () => {
		const content = legacyContent({
			excluded: [],
			excludedText: "Harm to children, on screen\nSexual violence",
		});
		expect(content.excluded).toEqual(["Harm to children, on screen", "Sexual violence"]);
	});

	it("appends to entries the section already had, rather than replacing them", () => {
		const content = legacyContent({ veiled: ["Torture"], veiledText: "Animal death in detail" });
		expect(content.veiled).toEqual(["Torture", "Animal death in detail"]);
	});

	// A box people wrote in has blank lines between paragraphs and trailing whitespace at the end of
	// it; neither is an agreement.
	it("makes no entry out of a blank line or stray whitespace", () => {
		const content = legacyContent({
			specialHandling: [],
			specialHandlingText: "  Tegwen — check in before a scene with her  \n\n\n",
		});
		expect(content.specialHandling).toEqual(["Tegwen — check in before a scene with her"]);
	});

	it("drops the text field once it has been folded in", () => {
		const content = legacyContent({ excluded: [], excludedText: "Sexual violence" });
		expect(content).not.toHaveProperty("excludedText");
	});

	it("leaves a section alone when its box was empty", () => {
		const content = legacyContent({ excluded: ["Sexual violence"], excludedText: "" });
		expect(content.excluded).toEqual(["Sexual violence"]);
		expect(content).not.toHaveProperty("excludedText");
	});

	// Idempotent by construction — the second run finds no text key at all — but it is the property
	// that matters, because migrateData runs on every update this model ever migrates.
	it("does not fold the same text in twice", () => {
		const source = { content: { excluded: [], excludedText: "Sexual violence" } };
		migrateSteadingShape(source);
		migrateSteadingShape(source);
		expect(source.content.excluded).toEqual(["Sexual violence"]);
	});

	it("touches nothing in a modern content diff", () => {
		const diff = { content: { excluded: ["Sexual violence"], veiled: [], specialHandling: [] } };
		expect(migrateSteadingShape(structuredClone(diff))).toEqual(diff);
	});
});

// The rule the assets heal broke, stated once for all of them: migrateData runs on update DIFFS as
// well as on whole sources, and a diff is a list of what the caller means to change. A heal may
// transform a key that is present; introducing one that is not turns every edit into a write against
// a field nobody touched.
describe("migrateSteadingShape — a diff comes back saying only what it said", () => {
	const diffs = {
		"a note":        { notes: "The harvest came in early." },
		"a rating":      { attributes: { prosperity: 2 } },
		"a debility":    { debilities: { lacking: true } },
		"the roster":    { folk: [{ id: "1", name: "Bryn", home: "" }] },
		"a place link":  { placesOfInterest: [{ name: "The Stone", linkUuid: "" }] },
		"the roll mode": { rollMode: "advantage" },
		"a content list": { content: { excluded: ["Sexual violence"] } },
	};

	for (const [what, diff] of Object.entries(diffs)) {
		it(`introduces no key into a diff changing ${what}`, () => {
			const migrated = migrateSteadingShape(structuredClone(diff));
			expect(Object.keys(migrated).sort()).toEqual(Object.keys(diff).sort());
		});
	}
});
