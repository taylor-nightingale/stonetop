import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { Seasons } from "../../src/model/data/steading/Seasons.js";

// Move icons are item images pointing at COMMITTED assets — a pack icon under the gitignored art
// store would be missing for everyone who hasn't run the installer, and would 404 on every render.

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

describe("pack move icons", () => {
	const withIcons = moveFiles().map(f => [f, load(f)]).filter(([, m]) => m.img);

	it("gives every Seasons Change move its season's glyph", () => {
		for (const season of Seasons.all()) {
			const file = `packs/src/moves/seasons/${season.moveSlug}.json`;
			expect(load(file).img).toBe(`systems/stonetop/assets/content/seasons/season-${season.key}.png`);
		}
	});

	it("points every move icon at a file that actually ships", () => {
		for (const [file, move] of withIcons) {
			const onDisk = move.img.replace(/^systems\/stonetop\//, "");
			expect(existsSync(path.join(root, onDisk)), `${file} -> ${move.img}`).toBe(true);
		}
	});

	// The gitignored store is installer-provided; only committed assets/ may be referenced as an icon.
	it("never points a move icon at the gitignored art store", () => {
		for (const [file, move] of withIcons) {
			expect(move.img.startsWith("stonetop-art/"), file).toBe(false);
		}
	});
});
