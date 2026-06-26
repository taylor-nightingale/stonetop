import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";

// The lore generator (scripts/local/lore/build.mjs) materializes each Book II
// topic (gods, factions, world-reference) as a JournalEntry holding ONE
// structured `location` page whose system.sections[] drive the
// StonetopLocationPageSheet — the same shape the locations pack uses. This
// guards that:
//   • exactly one `location` page per entry
//   • every section is a valid kind with the matching payload
//   • the gazetteer "Questions" section is a `qa` section with prompts
//   • the old `.stonetop-location-body` prose wrapper is gone

const SRC = path.resolve("packs/src");
const LORE_DIR = path.join(SRC, "stonetop-lore");

async function readDocs(dir) {
	const out = [];
	async function walk(d) {
		for (const e of await fs.readdir(d, { withFileTypes: true })) {
			if (e.name === "_folders") continue;
			const full = path.join(d, e.name);
			if (e.isDirectory()) await walk(full);
			else if (e.name.endsWith(".json")) out.push({ file: path.relative(SRC, full), doc: JSON.parse(await fs.readFile(full, "utf8")) });
		}
	}
	await walk(dir);
	return out;
}

let entries;

beforeAll(async () => {
	entries = await readDocs(LORE_DIR);
});

describe("lore journal — structured location pages", () => {
	it("found lore entries", () => {
		expect(entries.length).toBeGreaterThan(0);
	});

	it("every entry has exactly one `location` page", () => {
		const bad = entries.filter(({ doc }) =>
			!Array.isArray(doc.pages) || doc.pages.length !== 1 || doc.pages[0].type !== "location"
		);
		expect(bad.map(b => b.file)).toEqual([]);
	});

	it("every section is a valid kind with a matching payload", () => {
		const bad = [];
		for (const { file, doc } of entries) {
			const sections = doc.pages?.[0]?.system?.sections;
			if (!Array.isArray(sections) || !sections.length) { bad.push(`${file}: no sections`); continue; }
			for (const [i, s] of sections.entries()) {
				if (!["prose", "qa", "groups"].includes(s.kind)) { bad.push(`${file}#${i}: bad kind ${s.kind}`); continue; }
				if (typeof s.heading !== "string") bad.push(`${file}#${i}: missing heading`);
				if (s.kind === "qa") {
					if (!Array.isArray(s.pairs)) bad.push(`${file}#${i}: qa without pairs[]`);
					else if (s.pairs.some(p => typeof p.prompt !== "string" || typeof p.answer !== "string"))
						bad.push(`${file}#${i}: qa pair not {prompt,answer}`);
				} else if (s.kind === "groups") {
					if (!Array.isArray(s.groups)) bad.push(`${file}#${i}: groups without groups[]`);
					else if (s.groups.some(g => typeof g.heading !== "string" || typeof g.body !== "string"))
						bad.push(`${file}#${i}: group entry not {heading,body}`);
				} else if (typeof s.body !== "string") {
					bad.push(`${file}#${i}: prose without body`);
				}
			}
		}
		expect(bad).toEqual([]);
	});

	it("the Questions section is a `qa` section with at least one prompt", () => {
		const bad = [];
		for (const { file, doc } of entries) {
			const q = (doc.pages?.[0]?.system?.sections ?? []).find(s => s.heading === "Questions");
			if (!q) continue; // not every topic has Questions
			if (q.kind !== "qa") bad.push(`${file}: Questions is ${q.kind}, not qa`);
			else if (!(q.pairs ?? []).some(p => p.prompt?.trim())) bad.push(`${file}: Questions has no prompts`);
		}
		expect(bad).toEqual([]);
	});

	it("no section retains the old `.stonetop-location-body` wrapper", () => {
		const bad = entries.filter(({ doc }) =>
			(doc.pages?.[0]?.system?.sections ?? []).some(s => (s.body ?? "").includes("stonetop-location-body"))
		);
		expect(bad.map(b => b.file)).toEqual([]);
	});
});
