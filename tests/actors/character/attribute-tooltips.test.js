import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// Nothing renders .hbs in these tests (Foundry compiles the templates), so assert the template and
// the localization file agree: a tooltip whose key has no entry renders the key itself into the
// hover, which looks like a bug to the player and fails nothing.
const read = rel => readFileSync(path.resolve(process.cwd(), rel), "utf8");
const template = read("templates/actor/partials/actor-attributes.hbs");
const en = JSON.parse(read("languages/en.json"));

const lookup = key => key.split(".").reduce((node, part) => node?.[part], en);

describe("actor-attributes.hbs tooltips", () => {
	it("hovers XP with the book's definition", () => {
		expect(template).toContain("data-tooltip=\"{{localize 'stonetop.character.attributes.desc.xp'}}\"");
		expect(lookup("stonetop.character.attributes.desc.xp")).toMatch(/experience points/);
	});

	// Book I, p.53 gives all three ways a character marks XP; a hover that listed only some would be
	// worse than none, since a GM would trust it.
	it.each([/get a 6-/, /End of Session/, /another move says so/])(
		"names %s as a way to mark XP", pattern => {
			expect(lookup("stonetop.character.attributes.desc.xp")).toMatch(pattern);
		});

	it("points every tooltip in the row at a defined localization key", () => {
		const keys = [...template.matchAll(/data-tooltip="\{\{localize '([^']+)'\}\}"/g)].map(m => m[1]);
		expect(keys.length).toBeGreaterThan(0);
		for (const key of keys) expect(lookup(key), key).toBeTypeOf("string");
	});

	// HP, damage and armor spend their hover on provenance (where the number came from), which is the
	// more useful thing in play; this pins that split so a later edit doesn't quietly swap one for a
	// definition and lose the breakdown.
	it.each(["hp", "damage", "armor"])("keeps %s's hover on its provenance source", stat => {
		expect(template).toContain(`data-tooltip="{{stonetop.vitals.sources.${stat}}}"`);
	});
});
