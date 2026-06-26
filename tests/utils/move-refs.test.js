import { describe, it, expect } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { MOVE_REF_NAMES } from "../../module/utils/move-refs.js";

// The move cross-reference hover wraps a curated set of basic/expedition move names
// wherever they appear in move text. Those names must match real move items exactly
// — a rename in the pack would silently turn a hover into a dead, tooltip-less word
// — and a newly added basic/expedition move should be reconsidered for the list
// rather than silently dropping off it. Hold MOVE_REF_NAMES to the actual pack so
// either kind of drift fails here instead of shipping.

const ITEMS_DIR = path.resolve("packs/src/stonetop-items");

// Basic/expedition moves intentionally left off the cross-ref list (Interfere has
// no standalone "go read this" text a new player needs surfaced on hover).
const EXCLUDED = new Set(["Interfere"]);

async function moveNamesIn(subdir) {
	const dir   = path.join(ITEMS_DIR, subdir);
	const files = (await fs.readdir(dir)).filter(f => f.endsWith(".json"));
	return Promise.all(files.map(async f =>
		JSON.parse(await fs.readFile(path.join(dir, f), "utf-8")).name
	));
}

async function basicAndExpeditionNames() {
	return [
		...(await moveNamesIn("basic-moves")),
		...(await moveNamesIn("expedition-moves")),
	];
}

describe("MOVE_REF_NAMES", () => {
	it("references only real basic/expedition move names (no rename drift)", async () => {
		const actual = new Set(await basicAndExpeditionNames());
		for (const name of MOVE_REF_NAMES) {
			expect(actual, `"${name}" is not a current basic/expedition move name`).toContain(name);
		}
	});

	it("covers every basic/expedition move except the known exclusions (no new move silently omitted)", async () => {
		const refs    = new Set(MOVE_REF_NAMES);
		const missing = (await basicAndExpeditionNames()).filter(n => !refs.has(n) && !EXCLUDED.has(n));
		expect(missing).toEqual([]);
	});

	it("has no duplicate entries", () => {
		expect(new Set(MOVE_REF_NAMES).size).toBe(MOVE_REF_NAMES.length);
	});
});
