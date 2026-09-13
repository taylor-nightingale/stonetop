import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { ChoiceGroupDefs } from "../../src/model/data/ChoiceGroupDefs.js";

// A choice row grants a move by SLUG — the card resolves it against the moves pack and renders the
// move itself as the row. A grant naming a move that has no pack file fails silently: the row draws
// an empty box where the move's words should be.
//
// This is a real hazard of the arcana build, not a hypothetical: parseFront promotes a rollable
// trigger into a move grant, and the builder writes the move file in a separate step — a card whose
// write path forgot that step shipped the grant with nothing behind it.

const PACKS_DIR = path.resolve("packs/src");
const MOVES_DIR = path.join(PACKS_DIR, "moves");

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

describe("Move grants resolve to real move pack files", () => {
	let granters, moveSlugs;
	beforeAll(async () => {
		const docs = await readJsonTree(PACKS_DIR);
		moveSlugs = new Set((await readJsonTree(MOVES_DIR))
			.filter(m => m.doc.type === "move").map(m => m.doc.system?.slug));
		granters = docs
			.map(({ file, doc }) => ({ file, grants: ChoiceGroupDefs.grants(doc.system ?? {}, "move") }))
			.filter(g => g.grants.length);
	});

	it("loads the moves pack sources and something that grants one", () => {
		expect(moveSlugs.size).toBeGreaterThan(0);
		expect(granters.length).toBeGreaterThan(0);
	});

	it("every move grant names a move that exists", () => {
		const missing = granters.flatMap(({ file, grants }) =>
			grants.filter(g => !moveSlugs.has(g.slug)).map(g => `${file} → ${g.slug}`));
		expect(missing).toEqual([]);
	});
});
