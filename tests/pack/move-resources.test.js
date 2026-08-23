import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

// A move that tells the player to hold something needs somewhere to hold it. That place is
// `system.resource` — the same field Piety and Favor already use — which every move surface turns
// into a pip track through ResourceController. Nothing about it is per-move code, so the only thing
// that decides whether Defend can hold its Readiness is this pack file.

const root = process.cwd();
const moveFiles = () => {
	const out = [];
	for (const dir of readdirSync(path.join(root, "packs/src/moves"), { withFileTypes: true })) {
		if (!dir.isDirectory() || dir.name === "_folders") continue;
		for (const f of readdirSync(path.join(root, "packs/src/moves", dir.name))) {
			if (f.endsWith(".json")) out.push(path.join("packs/src/moves", dir.name, f));
		}
	}
	return out;
};
const load = rel => JSON.parse(readFileSync(path.join(root, rel), "utf8"));

describe("pack move resources", () => {
	// 4, not 3: a 10+ holds 3, or 4 with a shield. The track is the wider of the two and says nothing
	// about which one this roll earned — the sheet shows the limit, it does not police it.
	it("lets Defend hold its Readiness, up to a shield-bearer's 4", () => {
		const defend = load("packs/src/moves/basic/defend.json");
		expect(defend.system.resource).toEqual({ max: 4 });
		expect(defend.system.description).toContain("Readiness");
	});

	// An untitled track is bare pips. Defend's are the only ones in the sidebar, right under the name
	// of the move that fills them, so a title would repeat what the row already says.
	it("gives Defend's track no title", () => {
		expect(load("packs/src/moves/basic/defend.json").system.resource.title ?? null).toBe(null);
	});

	it("gives every move resource a positive number of pips to draw", () => {
		for (const file of moveFiles()) {
			const resource = load(file).system?.resource;
			if (!resource) continue;
			expect(Number.isInteger(resource.max), `${file}: max must be a whole number of pips`).toBe(true);
			expect(resource.max, file).toBeGreaterThan(0);
		}
	});
});
