import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { TagGlossary } from "../../src/model/data/TagGlossary.js";

// Tags are one concept in the book and one stored shape here: an ordered list of tokens, under the
// name `tagList`.
// Most of the files that carry them are written by a generator (build-arcana, build-artifacts), but
// the outfit-items pack is hand-authored end to end and no generator covers it — this is the only
// thing standing between a hand-edit and a broken tag field, and the only thing that catches a
// generator drifting back to the old comma-string shape after a regen.

const root = process.cwd();

function* packFiles(dir) {
	for (const entry of readdirSync(dir)) {
		const full = path.join(dir, entry);
		if (statSync(full).isDirectory()) yield* packFiles(full);
		else if (entry.endsWith(".json")) yield full;
	}
}

const documents = [...packFiles(path.join(root, "packs/src"))]
	.map((file) => ({ file: path.relative(root, file), doc: JSON.parse(readFileSync(file, "utf8")) }));

/** Every `tags`/`tagList` in a document, with the path it sits at. */
function tagFields(node, at = "") {
	const found = [];
	const visit = (value, where) => {
		if (Array.isArray(value)) return value.forEach((v) => visit(v, `${where}[]`));
		if (!value || typeof value !== "object") return;
		for (const [key, child] of Object.entries(value)) {
			const here = where ? `${where}.${key}` : key;
			if (key === "tags" || key === "tagList") found.push({ path: here, key, value: child });
			visit(child, here);
		}
	};
	visit(node, at);
	return found;
}

// The stored shape is the token list itself — nothing about picker config or options belongs in a
// document's tag value.
const isStoredTags = (v) => Array.isArray(v) && v.every((t) => typeof t === "string" && t.trim());

const allFields = documents.flatMap(({ file, doc }) => tagFields(doc).map((f) => ({ ...f, file })));

describe("pack tag fields", () => {
	it("finds tag fields to check", () => {
		expect(allFields.length).toBeGreaterThan(300);
	});

	it("stores every tagList as a list of non-empty tokens", () => {
		const wrong = allFields
			.filter((f) => f.key === "tagList" && !isStoredTags(f.value))
			.map((f) => `${f.file} → ${f.path} (${JSON.stringify(f.value)?.slice(0, 60)})`);
		expect(wrong).toEqual([]);
	});

	// Picker config is not data: no document should carry `options`/`multi`/`allowCustom` in a tag
	// value ever again.
	it("leaves no Selection blob behind in a tag value", () => {
		const blobs = allFields
			.filter((f) => f.value && typeof f.value === "object" && !Array.isArray(f.value))
			.map((f) => `${f.file} → ${f.path}`);
		expect(blobs).toEqual([]);
	});

	// `tags` was the old name for gear tags on arcana and possessions. Two uses survive on purpose:
	// a group member's own tags (already the shared shape, and paired with a `traits` field of the
	// same kind — renaming half the pair would only make it read worse), and the suggestion pool,
	// which is a list of options rather than a value.
	it("leaves no gear tags under the retired `tags` name", () => {
		const allowed = /^system\.members\[\]\.tags$|^system\.memberSuggestions\.tags$/;
		const stragglers = allFields
			.filter((f) => f.key === "tags" && !allowed.test(f.path))
			.map((f) => `${f.file} → ${f.path}`);
		expect(stragglers).toEqual([]);
	});

	it("keeps a group member's tags in the shared shape", () => {
		for (const f of allFields.filter((f) => f.path === "system.members[].tags")) {
			expect(isStoredTags(f.value) || f.value.length === 0, `${f.file} → ${f.path}`).toBe(true);
		}
	});

	it("keeps the member suggestion pool a plain list of options", () => {
		for (const f of allFields.filter((f) => f.path === "system.memberSuggestions.tags")) {
			expect(Array.isArray(f.value), `${f.file} → ${f.path}`).toBe(true);
		}
	});
});

describe("pack gear tags against the glossary", () => {
	// Read the way the system reads them at i18nInit — the definitions are localized strings.
	const glossary = TagGlossary.fromTranslations(
		JSON.parse(readFileSync(path.join(root, "languages/en.json"), "utf8")).stonetop.tagGlossary);

	// Gear tags: everything except a creature's own stat-block tags, whose vocabulary is its own.
	const gearTags = new Set(
		allFields
			.filter((f) => f.key === "tagList" && isStoredTags(f.value))
			.filter(({ file, path: p }) => !(p === "system.tagList" && /wider-world-npcs|followers/.test(file)))
			.flatMap((f) => f.value));

	// The book says "others are certainly possible", so an undefined tag is legal — but pinning the
	// list means a typo ("clsoe") fails here instead of silently rendering without a tooltip.
	it("defines every gear tag the packs use, bar the known exception", () => {
		const undefinedTags = [...gearTags].filter((t) => !glossary.lookup(t)).sort();
		expect(undefinedTags).toEqual(["large"]);
	});

	it("uses the book's own spelling for the range tags", () => {
		for (const range of ["hand", "close", "reach", "near", "far"]) {
			expect(glossary.lookup(range).category).toBe("range");
		}
	});
});
