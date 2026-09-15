import { describe, expect, it } from "vitest";
import { Corpus, CorpusAddress } from "../../scripts/i18n/corpus.js";

const english = (bySlug) => new Map(Object.entries(bySlug).map(([slug, keys]) => [slug, new Map(Object.entries(keys))]));
const corpus  = (packs) => new Corpus(new Map(Object.entries(packs).map(
	([pack, { en, de }]) => [pack, { english: english(en), authoring: de ?? {} }])));

const at = (corpus, pack, slug, key) => corpus.packs.get(pack).authoring[slug]?.[key];

describe("CorpusAddress", () => {
	it("compares by all three parts", () => {
		const a = new CorpusAddress("moves", "bolster", "description");
		expect(a.equals(new CorpusAddress("moves", "bolster", "description"))).toBe(true);
		expect(a.equals(new CorpusAddress("arcana", "bolster", "description"))).toBe(false);
		expect(a.equals(null)).toBe(false);
	});
});

describe("Corpus.englishBySlug", () => {
	it("flattens the type layer away, since slugs are unique within a pack", () => {
		const catalog = new Map([["move", new Map([["bolster", new Map([["name", "Bolster"]])]])]]);
		expect(Corpus.englishBySlug(catalog).get("bolster").get("name")).toBe("Bolster");
	});
});

describe("relocating a string that moved packs", () => {
	// A move pulled out of an arcanum: same English, new document, translation left behind.
	const extracted = () => corpus({
		arcana: { en: { "cracked-flute": { name: "Cracked Flute" } },
		          de: { "cracked-flute": { "choices/1/text": { source: "When you play it…", text: "Wenn du sie spielst…" } } } },
		moves:  { en: { "spend-few-days": { description: "When you play it…" } }, de: {} },
	});

	it("finds the orphan's English in another pack", () => {
		const [move] = extracted().relocations();
		expect(move.from.label).toBe("arcana/cracked-flute choices/1/text");
		expect(move.to.label).toBe("moves/spend-few-days description");
	});

	it("moves the German there and takes it off the orphan", () => {
		const c = extracted();
		c.apply();
		expect(at(c, "moves", "spend-few-days", "description").text).toBe("Wenn du sie spielst…");
		expect(at(c, "arcana", "cracked-flute", "choices/1/text")).toBeUndefined();
	});

	it("leaves an orphan alone when the target is already translated", () => {
		const c = corpus({
			arcana: { en: {}, de: { flute: { "choices/1/text": { source: "Same", text: "Alt" } } } },
			moves:  { en: { spend: { description: "Same" } }, de: { spend: { description: { source: "Same", text: "Schon da" } } } },
		});
		expect(c.relocations()).toHaveLength(0);
	});

	it("will not choose between two documents holding the same English", () => {
		const c = corpus({
			arcana: { en: {}, de: { flute: { "choices/1/text": { source: "Same", text: "Deutsch" } } } },
			moves:  { en: { one: { description: "Same" }, two: { description: "Same" } }, de: {} },
		});
		expect(c.relocations()).toHaveLength(0);
	});

	it("does not relocate an orphan that never recorded its English", () => {
		const c = corpus({
			arcana: { en: {}, de: { flute: { "choices/1/text": { source: "", text: "Deutsch" } } } },
			moves:  { en: { spend: { description: "Anything" } }, de: {} },
		});
		expect(c.relocations()).toHaveLength(0);
	});

	it("gives a target to one orphan only", () => {
		const c = corpus({
			arcana: { en: {}, de: {
				a: { "choices/1/text": { source: "Same", text: "Erste" } },
				b: { "choices/1/text": { source: "Same", text: "Zweite" } },
			} },
			moves: { en: { spend: { description: "Same" } }, de: {} },
		});
		expect(c.relocations()).toHaveLength(1);
	});
});

describe("reusing German for identical English", () => {
	const repeated = () => corpus({
		"steading-improvements": {
			en: { housing: { "effects/0/text": "increase Fortunes by 1" },
			      mill:    { "effects/0/text": "increase Fortunes by 1" } },
			de: { housing: { "effects/0/text": { source: "increase Fortunes by 1", text: "erhöhe Schicksal um 1" } } },
		},
	});

	it("fills an untranslated string from identical English translated elsewhere", () => {
		const { fills } = repeated().memoryFills();
		expect(fills).toHaveLength(1);
		expect(fills[0].address.label).toBe("steading-improvements/mill effects/0/text");
		expect(fills[0].german).toBe("erhöhe Schicksal um 1");
		expect(fills[0].reusedFrom.slug).toBe("housing");
	});

	it("writes the fill in with the current English as its source", () => {
		const c = repeated();
		c.apply();
		expect(at(c, "steading-improvements", "mill", "effects/0/text"))
			.toEqual({ source: "increase Fortunes by 1", text: "erhöhe Schicksal um 1" });
	});

	it("fills nothing when the same English was translated two ways", () => {
		const c = corpus({ steadfasts: {
			en: { a: { x: "curious" }, b: { x: "curious" }, c: { x: "curious" } },
			de: { a: { x: { source: "curious", text: "neugierig" } },
			      b: { x: { source: "curious", text: "Neugierig" } } },
		} });
		const { fills, conflicts } = c.memoryFills();
		expect(fills).toHaveLength(0);
		expect(conflicts).toHaveLength(1);
		expect(conflicts[0].germans.sort()).toEqual(["Neugierig", "neugierig"]);
	});

	it("reuses across packs, not only within one", () => {
		const c = corpus({
			moves:  { en: { a: { name: "Consequences" } }, de: { a: { name: { source: "Consequences", text: "Folgen" } } } },
			arcana: { en: { b: { name: "Consequences" } }, de: {} },
		});
		expect(c.memoryFills().fills[0].german).toBe("Folgen");
	});

	it("leaves a string nobody has translated alone", () => {
		const c = corpus({ moves: { en: { a: { name: "Brand new" } }, de: {} } });
		expect(c.memoryFills().fills).toHaveLength(0);
	});

	// Relocations are written in before fills are computed, so an address that just received one
	// reads as translated rather than as a vacancy to fill over.
	it("does not fill over an address a relocation just landed on", () => {
		const c = corpus({
			arcana: { en: {}, de: { flute: { "choices/1/text": { source: "Shared line", text: "Verschoben" } } } },
			moves:  { en: { one: { description: "Shared line" } },
			          de: { two: { name: { source: "Shared line", text: "Anders" } } } },
		});
		const { relocations, fills } = c.apply();
		expect(relocations).toHaveLength(1);
		expect(fills).toHaveLength(0);
		expect(at(c, "moves", "one", "description").text).toBe("Verschoben");
	});
});
