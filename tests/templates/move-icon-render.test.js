import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

// One renderer: move-item.hbs is the single body every move surface goes through (moves tab,
// side-bar, arcanum cards, choice-row grants, the seasons tab), so the icon is emitted once and
// every surface matches. A second <img> keyed off a move's icon anywhere else means two renderings
// that can drift.

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
	it("is emitted by move-item, guarded so a move without one renders unchanged", () => {
		const template = read("templates/actor/partials/move-item.hbs");
		expect(template).toContain("{{#if icon}}");
		expect(template).toContain('class="stonetop-move-icon" src="{{icon}}"');
	});

	// The chat card is a separate template, but takes its icon from the same move data.
	it("is emitted by the chat card too", () => {
		expect(read("templates/chat/move-roll.hbs")).toContain('class="stonetop-move-icon" src="{{icon}}"');
	});

	it("is styled once, for every surface", () => {
		const css = read("styles/stonetop.css");
		expect(css.match(/\.stonetop-move-icon\s*\{/g)).toHaveLength(1);
	});

	// The seasons tab used to hand-roll its own glyph markup; it renders through move-group now.
	it("has no second per-move icon renderer", () => {
		const others = hbsFiles("templates")
			.filter(f => !f.endsWith("move-item.hbs") && !f.endsWith("move-roll.hbs"))
			.filter(f => read(f).includes("stonetop-move-icon") || /season-icon/.test(read(f)));
		expect(others).toEqual([]);
	});

	// The Season tab no longer renders one move GROUP: the incoming season's move is in the turn
	// control and each season's own move hangs off its segment of the wheel. Both still go through
	// the shared move partials, which is what this file is actually about — the tab has never been
	// allowed a bespoke icon of its own.
	it("renders the seasons tab's moves through the shared move row", () => {
		for (const file of ["templates/actor/partials/steading-season-turn.hbs",
		                    "templates/actor/partials/steading-season-wheel.hbs"]) {
			expect(read(file)).toContain('{{> "stonetop.move-row"');
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
		for (const file of ["templates/actor/partials/steading-season-turn.hbs", "templates/actor/steading.hbs"]) {
			expect(read(file)).not.toContain("stonetop-move-icon");
			expect(read(file)).not.toContain("--steading-glyph:");
		}
		const css = read("styles/stonetop.css");
		expect(css).toContain('--steading-glyph: url("../assets/content/seasons/season-spring.png")');
	});
});
