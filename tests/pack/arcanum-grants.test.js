import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { ChoiceGroupDefs } from "../../src/model/data/ChoiceGroupDefs.js";

// A choice row grants an arcanum by SLUG — ArcanumSideEffectHandler looks it up in the arcana pack and
// embeds the card when the row is marked. A grant naming an arcanum that doesn't exist fails silently:
// the box ticks, nothing lands on the Arcana tab. This guards that wiring across every pack source that
// grants one (the Seeker's backgrounds today).

const PACKS_DIR  = path.resolve("packs/src");
const ARCANA_DIR = path.join(PACKS_DIR, "arcana");

async function readJsonTree(dir) {
	const out = [];
	for (const e of await fs.readdir(dir, { withFileTypes: true })) {
		const full = path.join(dir, e.name);
		if (e.isDirectory()) {
			if (e.name.startsWith("_")) continue;
			out.push(...await readJsonTree(full));
		} else if (e.name.endsWith(".json") && !e.name.startsWith("_")) {
			out.push({ file: path.relative(PACKS_DIR, full), doc: JSON.parse(await fs.readFile(full, "utf8")) });
		}
	}
	return out;
}

describe("Arcanum grants resolve to real arcana pack files", () => {
	let granters, arcanaSlugs;
	beforeAll(async () => {
		const docs = await readJsonTree(PACKS_DIR);
		arcanaSlugs = new Set((await readJsonTree(ARCANA_DIR))
			.filter(a => a.doc.type === "arcanum").map(a => a.doc.system?.slug));
		granters = docs
			.map(({ file, doc }) => ({ file, doc, grants: ChoiceGroupDefs.grants(doc.system ?? {}, "arcanum") }))
			.filter(g => g.grants.length);
	});

	it("loads the arcana pack sources and something that grants one", () => {
		expect(arcanaSlugs.size).toBeGreaterThan(0);
		expect(granters.length).toBeGreaterThan(0);
	});

	it("every arcanum grant names an arcanum that exists", () => {
		const missing = granters.flatMap(({ file, grants }) => grants
			.filter(g => !arcanaSlugs.has(g.slug))
			.map(g => `${file}: grants unknown arcanum "${g.slug}"`));
		expect(missing).toEqual([]);
	});

	// Marking the row is what makes the character own the card, and buildEntryRow renders a track only
	// for a row with BOTH a slug and a `track` — a grant anywhere else can never fire.
	it("every arcanum grant sits on a row that can be marked", () => {
		const unmarkable = granters.flatMap(({ file, doc }) => ChoiceGroupDefs.findAll(doc.system ?? {})
			.flatMap(group => (group.def.list ?? [])
				.filter(row => (row.grants ?? []).some(g => g.type === "arcanum"))
				.filter(row => !(row.slug && row.track))
				.map(row => `${file}: arcanum grant on an unmarkable row "${row.slug ?? "(no slug)"}"`)));
		expect(unmarkable).toEqual([]);
	});
});
