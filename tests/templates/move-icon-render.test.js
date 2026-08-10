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

	it("renders the seasons tab through the shared move group", () => {
		const seasons = read("templates/actor/partials/steading-seasons.hbs");
		expect(seasons).toContain('{{> "stonetop.move-group"');
		expect(seasons).not.toContain("<img class=\"steading-season-icon\"");
	});
});
