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
		expect(entries).toEqual([{ key: "name", path: "name", text: "The Seeker" }]);
	});

	it("drops the system prefix from the key but keeps it in the path", () => {
		const entries = translatableEntries({ system: { statsNote: "+2, +1" } }, ["system.statsNote"]);
		expect(entries[0]).toEqual({ key: "statsNote", path: "system.statsNote", text: "+2, +1" });
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

	it("falls back to the index for elements with no slug", () => {
		const source = { system: { appearance: { list: [
			{ content: { text: "upstart youth" } },
			{ slug: "weathered", content: { text: "weathered" } },
		] } } };
		const entries = translatableEntries(source, ["system.appearance.list[].content.text"]);
		expect(keys(entries)).toEqual(["appearance/0/text", "appearance/weathered/text"]);
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

	it("still keys objects by slug, and falls back to index only for slugless objects", () => {
		const source = { system: { choices: [{ slug: "g", list: [
			{ slug: "row-a", content: { text: "A" } },
			{ content: { text: "B" } },
		] }] } };
		expect(keys(translatableEntries(source, ["system.choices[].list[].content.text"])))
			.toEqual(["choices/g/row-a/text", "choices/g/1/text"]);
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
