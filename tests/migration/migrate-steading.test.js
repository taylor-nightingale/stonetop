import { describe, it, expect } from "vitest";
import { isTaylorOriginSteading, buildSteadingMigration } from "../../module/migration/migrate-steading.js";

// A realistic Taylor-origin steading RAW source (his SteadingData shape — what
// SteadingModel.migrateData stashes into system.classicTaylor before cleanData coerces it).
const taylorSteading = {
	description: "<p>A hill village.</p>",
	notes: "troubled",
	fortunes: 2,                                         // top-level (his) → fork stats.fortunes
	surplus:  3,                                         // top-level (his) → fork attributes.surplus
	debilities: { diminished: true, lacking: false, malcontent: false }, // flat → fork options.<k>.value
	attributes: {
		size:       { current: 1, items: ["More than 100 souls"] },        // no fork home → classic
		population: { current: 1, items: ["A few hundred"] },              // current → value; items → classic
		prosperity: { current: 0, items: ["Farming (beans, potatoes)", "A new dye-works"] }, // items → resources
		defenses:   { current: 1, items: ["Village militia", "Palisade"] },// current → stats.defenses; items → fortifications
	},
	assets: {
		items: ["A pair of hardy draft horses", "A wagon"],
		coinage: [{ title: "silver", purses: 1, handfuls: 2, coins: 3 }, { title: "gold", purses: 0, handfuls: 0, coins: 5 }],
	},
	content: { excluded: ["torture"], veiled: ["romance"], specialHandling: ["undead"],
		excludedText: "none on-camera", veiledText: "fade to black", specialHandlingText: "check in first" }, // safety-tools gap
	placesOfInterest: ["The Stone", "The Granary", "A new shrine"],
	neighborPlaces: [{ slug: "marshedge", name: "Marshedge", subtitle: "", note: "allies", names: "Abben, Brin" }], // gap
	residents:      [{ id: "a1", name: "Bryn", occupation: "smith",  traits: "stoic" }],
	neighborPeople: [{ id: "n1", name: "Coln", occupation: "trader", traits: "shrewd", home: "Marshedge" }],
	improvements: { pickValues: { palisade: { "pull-together": 1 } } },
};

describe("isTaylorOriginSteading", () => {
	it("detects his steading by raw telltales or the stash; rejects fork-native + non-steadings", () => {
		expect(isTaylorOriginSteading({ type: "stonetop", _source: { system: { fortunes: 2 } } })).toBe(true);
		expect(isTaylorOriginSteading({ type: "stonetop", _source: { system: { classicTaylor: { fortunes: 1 } } } })).toBe(true);
		expect(isTaylorOriginSteading({ type: "stonetop", _source: { system: { content: { excluded: [] } } } })).toBe(true);
		// fork-native steading: system is only the stat block (data lives in flags), no telltales.
		expect(isTaylorOriginSteading({ type: "stonetop", _source: { system: { stats: { fortunes: { value: 1 } }, attributes: { population: { value: 0 } } } } })).toBe(false);
		expect(isTaylorOriginSteading({ type: "character", _source: { system: { fortunes: 2 } } })).toBe(false);
	});
});

describe("buildSteadingMigration", () => {
	const u = buildSteadingMigration(taylorSteading, "stonetop");

	it("reshapes the stat block: index→bonus for fortunes/pop/prosp/def, raw surplus, only-true debilities", () => {
		// His fortunes/pop/prosp/def are INDICES into [-1,0,1,2,3]; fork stores the bonus (= index-1).
		expect(u["system.stats.fortunes.value"]).toBe(1);        // index 2 → +1
		expect(u["system.attributes.surplus.value"]).toBe(3);    // raw (not an index)
		expect(u["system.attributes.population.value"]).toBe(0); // index 1 → +0
		expect(u["system.attributes.prosperity.value"]).toBe(-1);// index 0 → -1
		expect(u["system.stats.defenses.value"]).toBe(0);        // index 1 → +0
		expect(u["system.attributes.debilities.options.diminished.value"]).toBe(true);
		expect(u).not.toHaveProperty("system.attributes.debilities.options.lacking.value"); // false → skipped
		expect(u["system.description"]).toBe("<p>A hill village.</p>");
	});

	it("maps lists into the single steading flag object (assets/resources/fortifications/places/coinage/notes)", () => {
		const st = u["flags.stonetop.steading"];
		expect(st.notes).toBe("troubled");
		expect(st.assets).toEqual([{ name: "A pair of hardy draft horses", checked: true }, { name: "A wagon", checked: true }]);
		expect(st.resources).toEqual([{ name: "Farming (beans, potatoes)", checked: true }, { name: "A new dye-works", checked: true }]);
		expect(st.fortifications).toEqual([{ name: "Village militia", checked: true }, { name: "Palisade", checked: true }]);
		expect(st.places).toEqual([{ letter: "A", name: "The Stone" }, { letter: "B", name: "The Granary" }, { letter: "C", name: "A new shrine" }]);
		expect(st.silver).toEqual({ purses: 1, handfuls: 2, coins: 3 });
		expect(st.gold).toEqual({ purses: 0, handfuls: 0, coins: 5 });
	});

	it("maps residents + neighbor people with the fork row defaults", () => {
		const st = u["flags.stonetop.steading"];
		expect(st.residents).toEqual([{ name: "Bryn", occupation: "smith", traits: "stoic", relations: "", notes: "", checked: false }]);
		expect(st.neighbors).toEqual([{ name: "Coln", occupation: "trader", traits: "shrewd", relations: "", notes: "", checked: false, home: "Marshedge" }]);
	});

	it("gives the safety-tools content + neighborPlaces verbatim flag homes (parity gaps)", () => {
		const st = u["flags.stonetop.steading"];
		expect(st.content).toEqual(taylorSteading.content);
		expect(st.neighborPlaces).toEqual(taylorSteading.neighborPlaces);
	});

	it("preserves divergent improvements + attribute item-lists verbatim under classic (inert)", () => {
		const st = u["flags.stonetop.steading"];
		expect(st.classic.improvementPickValues).toEqual({ palisade: { "pull-together": 1 } });
		expect(st.classic.sizeCurrent).toBe(1);            // his numeric size track, preserved inert (fork size = label)
		expect(st.classic.sizeItems).toEqual(["More than 100 souls"]);
		expect(st.classic.populationItems).toEqual(["A few hundred"]);
	});

	it("returns {} for empty input", () => {
		expect(buildSteadingMigration({}, "stonetop")).toEqual({});
	});
});
