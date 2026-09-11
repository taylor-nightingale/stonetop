import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

// No move surface in play draws a move's icon. The pack still carries one on the four Seasons Change
// moves, because the COMPENDIUM directory lists items by their image and the season glyphs read well
// there — but on a sheet, and on a chat card, they were noise beside a name that already said which
// move it was. This file is the guard that the capability stays gone rather than creeping back into
// one surface at a time, which is how it arrived.

const root = process.cwd();
const read = rel => readFileSync(path.resolve(root, rel), "utf8");

function hbsFiles(dir, found = []) {
	for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
		const rel = path.join(dir, entry.name);
		if (entry.isDirectory()) hbsFiles(rel, found);
		else if (entry.name.endsWith(".hbs")) found.push(rel);
	}
	return found;
}

describe("move icon rendering", () => {
	it("is drawn by no move template at all", () => {
		for (const file of hbsFiles("templates")) {
			expect(read(file), file).not.toContain("stonetop-move-icon");
		}
	});

	// The pack keeps them: a compendium directory lists items by their image, and the four season
	// glyphs are the one place a move image earns its keep.
	it("keeps the season glyphs in the pack, for the compendium listing", () => {
		for (const season of ["spring", "summer", "autumn", "winter"]) {
			const move = JSON.parse(read(`packs/src/moves/seasons/seasons-change-${season}.json`));
			expect(move.img).toBe(`systems/stonetop/assets/content/seasons/season-${season}.png`);
		}
	});

	// The seasons tab used to hand-roll its own glyph markup; the four moves render through the
	// shared group now, in the rail beside the homefront ones. Nothing on the Season tab draws a
	// move: the wheel states the year, and the box is the current season broken into steps. So
	// neither of those files is allowed an icon of its own, which is what this file is about.
	it("renders the seasonal moves through the shared move group, in the rail", () => {
		expect(read("templates/actor/steading.hbs"))
			.toContain("moves=stonetop.seasonalMoves.moves");
		for (const file of ["templates/actor/partials/steading-season-box.hbs",
		                    "templates/actor/partials/steading-season-wheel.hbs"]) {
			expect(read(file)).not.toContain("<img class=\"steading-season-icon\"");
		}
	});

	// The season GLYPH is a different thing from a move icon: it is masked so it can take the season
	// tint, and it is decoration beside text that already names the season. It must never become a
	// second way of drawing a move's own icon.
	//
	// And the template must not name the image AT ALL. A path written here would be a document path
	// (systems/stonetop/…) dropped into a custom property, which resolves against the stylesheet
	// rather than the document — and an absolute one would skip an install's route prefix and 404.
	// The stylesheet owns the four paths, relative to itself.
	it("draws the season glyph by mask, and leaves its path to the stylesheet", () => {
		for (const file of ["templates/actor/partials/steading-season-box.hbs", "templates/actor/steading.hbs"]) {
			expect(read(file)).not.toContain("stonetop-move-icon");
			expect(read(file)).not.toContain("--steading-glyph:");
		}
		const css = read("styles/stonetop.css");
		expect(css).toContain('--steading-glyph: url("../assets/content/seasons/season-spring.png")');
	});
});
