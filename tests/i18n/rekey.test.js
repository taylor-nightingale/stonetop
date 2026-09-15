import { describe, expect, it } from "vitest";
import { KeyRenames, renamesBetween, schemeAt } from "../../scripts/i18n/rekey.js";

const improvement = (list) => ({
	type: "improvement",
	system: { slug: "additional-housing", choices: { slug: "additional-housing", list } },
});

const row = (text, slug) => (slug ? { slug, content: { text } } : { content: { text } });

describe("KeyRenames", () => {
	it("counts every rename across every document", () => {
		const renames = new KeyRenames();
		renames.add("a", "choices/0/text", "choices/one/text");
		renames.add("a", "choices/1/text", "choices/two/text");
		renames.add("b", "choices/0/text", "choices/three/text");
		expect(renames.size).toBe(3);
	});

	it("rewrites the keys it knows and leaves the rest alone", () => {
		const renames = new KeyRenames();
		renames.add("a", "choices/0/text", "choices/one/text");
		expect(renames.applyTo({ a: {
			"choices/0/text": { source: "One", text: "Eins" },
			name:             { source: "A",   text: "A"    },
		} })).toEqual({ a: {
			"choices/one/text": { source: "One", text: "Eins" },
			name:               { source: "A",   text: "A"    },
		} });
	});

	it("leaves a document it has no renames for untouched", () => {
		const authoring = { b: { name: { source: "B", text: "B" } } };
		expect(new KeyRenames().applyTo(authoring)).toEqual(authoring);
	});

	it("carries the entry across unchanged, German and review markers included", () => {
		const renames = new KeyRenames();
		renames.add("a", "old", "new");
		const entry = { source: "S", text: "Ü", needsReview: true };
		expect(renames.applyTo({ a: { old: entry } }).a.new).toEqual(entry);
	});

	it("survives an empty or missing authoring file", () => {
		expect(new KeyRenames().applyTo(undefined)).toEqual({});
		expect(new KeyRenames().applyTo({ a: {} })).toEqual({ a: {} });
	});
});

describe("renamesBetween", () => {
	// The old scheme is whatever the previous revision did; here it is stubbed to the index-only
	// behaviour this change replaced, so the pairing is exercised without depending on git history.
	const indexScheme = {
		translatableEntriesForType: (_type, doc) => doc.system.choices.list.map((entry, i) => ({
			key:  entry.slug ? `choices/${entry.slug}/text` : `choices/${i}/text`,
			path: `system.choices.list.${i}.content.text`,
			text: entry.content.text,
		})),
	};

	it("pairs the two schemes by path, so a moved key is renamed exactly", () => {
		const renames = renamesBetween(indexScheme, [improvement([row("And then:"), row("Pull together.")])]);
		expect(renames.renamesFor("additional-housing")).toEqual(new Map([
			["choices/0/text", "choices/and-then/text"],
			["choices/1/text", "choices/pull-together/text"],
		]));
	});

	it("records nothing for a key both schemes agree on", () => {
		const renames = renamesBetween(indexScheme, [improvement([row("Pull together.", "pull-together")])]);
		expect(renames.size).toBe(0);
	});

	it("skips documents with no slug and types that are not translated", () => {
		const nameless = { type: "improvement", system: { choices: { list: [row("x")] } } };
		const untranslated = { type: "npc", system: { slug: "nerth-serpent", choices: { list: [row("x")] } } };
		expect(renamesBetween(indexScheme, [nameless, untranslated]).size).toBe(0);
	});
});

describe("schemeAt", () => {
	it("loads a previous revision's key scheme without a second copy in the tree", async () => {
		const scheme = await schemeAt("HEAD");
		expect(typeof scheme.translatableEntriesForType).toBe("function");
		expect(typeof scheme.isTranslatableType).toBe("function");
	});
});
