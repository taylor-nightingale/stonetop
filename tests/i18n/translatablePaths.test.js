import { describe, expect, it } from "vitest";
import {
	TEXT_PATHS,
	isTranslatableType,
	translatableEntries,
	translatableEntriesForType,
} from "../../src/i18n/translatablePaths.js";

const keys  = entries => entries.map(e => e.key);
const byKey = (entries, key) => entries.find(e => e.key === key) ?? null;

describe("translatableEntries", () => {
	it("joins key segments with a slash, never a dot, so a language-file merge cannot expand them", () => {
		const source = { system: { choices: [{ slug: "g", list: [{ slug: "e", content: { text: "T" } }] }] } };
		const [entry] = translatableEntries(source, ["system.choices[].list[].content.text"]);
		expect(entry.key).not.toContain(".");
		expect(entry.key.split("/")).toEqual(["choices", "g", "e", "text"]);
	});

	it("reads a plain path", () => {
		const entries = translatableEntries({ name: "The Seeker" }, ["name"]);
		expect(entries).toEqual([{ key: "name", path: "name", mergePath: "name", text: "The Seeker" }]);
	});

	it("drops the system prefix from the key but keeps it in the path", () => {
		const entries = translatableEntries({ system: { statsNote: "+2, +1" } }, ["system.statsNote"]);
		expect(entries[0]).toEqual({
			key: "statsNote", path: "system.statsNote", mergePath: "system.statsNote", text: "+2, +1",
		});
	});

	// What babeleConverter hands back, and why it is not always the leaf: a merge swaps an array
	// wholesale rather than element by element, so an array is the finest grain a payload can name.
	describe("mergePath", () => {
		it("is the leaf itself when no array stands above it", () => {
			const source = { system: { moveResults: { success: { value: "Take 3." } } } };
			const [entry] = translatableEntries(source, ["system.moveResults.success.value"]);
			expect(entry.mergePath).toBe("system.moveResults.success.value");
		});

		it("is the array a translated string sits inside", () => {
			const source = { system: { effects: [{ text: "increase Fortunes by 1" }] } };
			const [entry] = translatableEntries(source, ["system.effects[].text"]);
			expect(entry.path).toBe("system.effects.0.text");
			expect(entry.mergePath).toBe("system.effects");
		});

		it("is the OUTERMOST array, never one nested inside it", () => {
			const source = { system: { choices: [{ slug: "g", list: [{ slug: "e", options: [{ text: "T" }] }] }] } };
			const [entry] = translatableEntries(source, ["system.choices[].list[].options[].text"]);
			expect(entry.path).toBe("system.choices.0.list.0.options.0.text");
			expect(entry.mergePath).toBe("system.choices");
		});

		it("is the array of bare strings, not the object holding it", () => {
			const source = { system: { instinct: { selected: ["to get distracted"], multi: false } } };
			const [entry] = translatableEntries(source, ["system.instinct.selected[]"]);
			expect(entry.mergePath).toBe("system.instinct.selected");
		});
	});

	it("keys array elements by their slug, not their position", () => {
		const source = { system: { backgrounds: [
			{ slug: "patriot",     description: "These people are family." },
			{ slug: "antiquarian", description: "The past has buried many secrets." },
		] } };
		const entries = translatableEntries(source, ["system.backgrounds[].description"]);
		expect(keys(entries)).toEqual([
			"backgrounds/patriot/description",
			"backgrounds/antiquarian/description",
		]);
		expect(byKey(entries, "backgrounds/antiquarian/description").path)
			.toBe("system.backgrounds.1.description");
	});

	it("keeps a slug key stable when elements are reordered", () => {
		const path = ["system.backgrounds[].description"];
		const a = { slug: "patriot", description: "Family." };
		const b = { slug: "antiquarian", description: "Secrets." };
		const before = translatableEntries({ system: { backgrounds: [a, b] } }, path);
		const after  = translatableEntries({ system: { backgrounds: [b, a] } }, path);
		expect(new Set(keys(before))).toEqual(new Set(keys(after)));
		expect(byKey(after, "backgrounds/patriot/description").path).toBe("system.backgrounds.1.description");
	});

	it("names a slugless element by its own content rather than its index", () => {
		const source = { system: { appearance: { list: [
			{ content: { text: "upstart youth" } },
			{ slug: "weathered", content: { text: "weathered" } },
		] } } };
		const entries = translatableEntries(source, ["system.appearance.list[].content.text"]);
		expect(keys(entries)).toEqual(["appearance/upstart-youth/text", "appearance/weathered/text"]);
	});

	it("drops the structural list and content segments from the key", () => {
		const source = { system: { choices: [
			{ slug: "arcana-major", list: [{ slug: "where-acquired", content: { text: "Where did you acquire it?" } }] },
		] } };
		const entries = translatableEntries(source, ["system.choices[].list[].content.text"]);
		expect(entries[0].key).toBe("choices/arcana-major/where-acquired/text");
		expect(entries[0].path).toBe("system.choices.0.list.0.content.text");
	});

	it("walks nested arrays", () => {
		const source = { system: { instinct: { list: [
			{ slug: "drives", options: [{ slug: "authority", description: "To take charge." }] },
		] } } };
		const entries = translatableEntries(source, ["system.instinct.list[].options[].description"]);
		expect(entries[0].key).toBe("instinct/drives/options/authority/description");
		expect(entries[0].path).toBe("system.instinct.list.0.options.0.description");
	});

	it("skips absent, empty and blank strings", () => {
		const source = { name: "  ", system: { description: "", statsNote: "kept" } };
		const entries = translatableEntries(source, [
			"name", "system.description", "system.statsNote", "system.startingMovesNote",
		]);
		expect(keys(entries)).toEqual(["statsNote"]);
	});

	it("ignores a path whose array field holds a non-array", () => {
		const source = { system: { backgrounds: { slug: "patriot", description: "x" } } };
		expect(translatableEntries(source, ["system.backgrounds[].description"])).toEqual([]);
	});

	it("returns nothing for an unknown or absent allowlist", () => {
		expect(translatableEntries({ name: "x" }, undefined)).toEqual([]);
		expect(translatableEntriesForType("npc", { name: "x" })).toEqual([]);
	});
});

describe("the playbook allowlist", () => {
	it("covers every item type a translator can reach, and nothing beyond it", () => {
		for (const type of ["playbook", "move", "arcanum", "possession", "follower",
			"outfitItem", "insert", "improvement", "steadfast"]) {
			expect(isTranslatableType(type), type).toBe(true);
		}
		// Actors and journals are a later pass and have no allowlist yet.
		for (const type of ["npc", "character", "steading"]) {
			expect(isTranslatableType(type), type).toBe(false);
		}
	});

	it("never exposes a slug, id or cross-pack reference", () => {
		const forbidden = /(^|\.)(slug|_id|_key|img|type|moves|startingMoves|followers|inserts|grants|preselected|slugs|input|track|locations)(\[\]|$|\.)/;
		for (const path of TEXT_PATHS.playbook) expect(path).not.toMatch(forbidden);
	});

	it("excludes the personal names in origin", () => {
		expect(TEXT_PATHS.playbook).not.toContain("system.origin[].names[]");
	});

	it("produces no duplicate keys within one document", () => {
		const source = {
			name: "The Seeker",
			system: {
				choices: [{ slug: "g", list: [{ slug: "e", content: { title: "T", text: "B" }, options: [{ slug: "o", text: "O" }] }] }],
				instinct:   { list: [{ slug: "e", content: { title: "T", text: "B" }, options: [{ slug: "o", text: "O", description: "D" }] }] },
				appearance: { list: [{ slug: "e", content: { title: "T", text: "B" }, options: [{ slug: "o", text: "O", description: "D" }] }] },
				backgrounds: [{ slug: "b", label: "L", description: "D",
					choices: { list: [{ slug: "e", content: { title: "T", text: "B" }, options: [{ slug: "o", text: "O" }] }] } }],
				introductions: {
					step3: "S3",
					step4: { list: [{ slug: "e", content: { title: "T", text: "B" } }] },
					step6: { list: [{ slug: "e", content: { title: "T", text: "B" } }] },
				},
			},
		};
		const found = keys(translatableEntriesForType("playbook", source));
		expect(found.length).toBe(new Set(found).size);
	});
});

describe("keys for array elements with no slug", () => {
	const labels = source => translatableEntries(source, ["system.resource.labels[]"]);

	it("keys a bare string by its own content", () => {
		const entries = labels({ system: { resource: { labels: ["low ammo", "fresh"] } } });
		expect(keys(entries)).toEqual(["resource/labels/low-ammo", "resource/labels/fresh"]);
	});

	// The whole point of content keys: an index moves when the list does, and every translation
	// below an insertion would slide onto the wrong string.
	it("keeps content keys stable across reordering and insertion", () => {
		const before = labels({ system: { resource: { labels: ["low ammo", "fresh"] } } });
		const after  = labels({ system: { resource: { labels: ["spent", "fresh", "low ammo"] } } });
		expect(keys(after)).toContain("resource/labels/low-ammo");
		expect(byKey(after, "resource/labels/fresh").path).toBe("system.resource.labels.1");
		expect(byKey(before, "resource/labels/fresh").path).toBe("system.resource.labels.1");
	});

	it("disambiguates two identical strings by position", () => {
		const entries = labels({ system: { resource: { labels: ["fresh", "spent", "fresh"] } } });
		expect(keys(entries)).toEqual([
			"resource/labels/fresh/0", "resource/labels/spent", "resource/labels/fresh/1",
		]);
	});

	it("prefers a slug, and names the rest by content", () => {
		const source = { system: { choices: [{ slug: "g", list: [
			{ slug: "row-a", content: { text: "A" } },
			{ content: { text: "B" } },
		] }] } };
		expect(keys(translatableEntries(source, ["system.choices[].list[].content.text"])))
			.toEqual(["choices/g/row-a/text", "choices/g/b/text"]);
	});

	// The reason this branch exists at all: steading improvements are 56% slugless rows, and an
	// insertion near the top used to slide every translation below it onto its neighbour's sentence.
	it("keeps a slugless row's key stable when a row is inserted above it", () => {
		const row  = text => ({ content: { text } });
		const path = ["system.choices[].list[].content.text"];
		const before = translatableEntries({ system: { choices: [{ slug: "g", list: [row("And then:"), row("Pull together.")] }] } }, path);
		const after  = translatableEntries({ system: { choices: [{ slug: "g", list: [row("Requires:"), row("And then:"), row("Pull together.")] }] } }, path);
		expect(keys(before)).toContain("choices/g/pull-together/text");
		expect(keys(after)).toContain("choices/g/pull-together/text");
	});

	it("names a row by its title in preference to its text", () => {
		const source = { system: { choices: [{ slug: "g", list: [
			{ content: { title: "Praise the day", text: "You are the appointed servant…" } },
		] }] } };
		expect(keys(translatableEntries(source, ["system.choices[].list[].content.title"])))
			.toEqual(["choices/g/praise-the-day/title"]);
	});

	// Shapes with no `content` block at all: an effect, a step, an origin, a member.
	it("names a content-less object by its own text, name or region", () => {
		const entries = translatableEntries(
			{ system: { effects: [{ text: "increase Fortunes by 1" }], origin: [{ region: "Stonetop" }] } },
			["system.effects[].text", "system.origin[].region"]);
		expect(keys(entries)).toEqual(["effects/increase-fortunes-by-1/text", "origin/stonetop/region"]);
	});

	it("truncates a long name so a key stays readable", () => {
		const long = "When you meet the requirements, increase Fortunes by 1 and add it to the map";
		const entries = translatableEntries({ system: { effects: [{ text: long }] } }, ["system.effects[].text"]);
		expect(keys(entries)).toEqual(["effects/when-you-meet-the-requirements-increase/text"]);
	});

	it("still falls back to the index for a row that carries no words of its own", () => {
		const source = { system: { choices: [{ slug: "g", list: [
			{ type: "pick", pickCount: 1, options: [{ slug: "sword", text: "Sword" }] },
		] }] } };
		expect(keys(translatableEntries(source, ["system.choices[].list[].options[].text"])))
			.toEqual(["choices/g/0/options/sword/text"]);
	});

	it("disambiguates two slugless rows that say the same thing", () => {
		const source = { system: { choices: [{ slug: "g", list: [
			{ content: { text: "Same" } }, { content: { text: "Same" } },
		] }] } };
		expect(keys(translatableEntries(source, ["system.choices[].list[].content.text"])))
			.toEqual(["choices/g/same/0/text", "choices/g/same/1/text"]);
	});

	// Two rows sharing a slug is a data bug; letting the key collide is how the extractor reports it.
	it("does not disambiguate duplicate slugs", () => {
		const source = { system: { choices: [{ slug: "g", list: [
			{ slug: "same", content: { text: "A" } },
			{ slug: "same", content: { text: "B" } },
		] }] } };
		expect(keys(translatableEntries(source, ["system.choices[].list[].content.text"])))
			.toEqual(["choices/g/same/text", "choices/g/same/text"]);
	});
});
