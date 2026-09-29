import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// Nothing renders .hbs in these tests (Foundry compiles the templates), so assert the template and
// the localization file agree: a tooltip whose key has no entry renders the key itself into the
// hover, which looks like a bug to the player and fails nothing.
const read = rel => readFileSync(path.resolve(process.cwd(), rel), "utf8");
// All five numbers are in the rail now: Armor, Level and Damage on the portrait (rail-identity), hit
// points and experience as bars that character.hbs draws. The hovers went with their own values.
const template = read("templates/actor/partials/rail-identity.hbs");
const advancement = read("templates/actor/character.hbs");
const en = JSON.parse(read("languages/en.json"));

const lookup = key => key.split(".").reduce((node, part) => node?.[part], en);

describe("the framed numbers' tooltips", () => {
	it("hovers XP with the book's definition, where the XP bar is drawn", () => {
		expect(advancement).toContain(`tooltip=(localize "stonetop.character.attributes.desc.xp")`);
		expect(lookup("stonetop.character.attributes.desc.xp")).toMatch(/experience points/);
	});

	// Book I, p.53 gives all three ways a character marks XP; a hover that listed only some would be
	// worse than none, since a GM would trust it.
	it.each([/get a 6-/, /End of Session/, /another move says so/])(
		"names %s as a way to mark XP", pattern => {
			expect(lookup("stonetop.character.attributes.desc.xp")).toMatch(pattern);
		});

	it("points the XP hover at a defined localization key", () => {
		expect(lookup("stonetop.character.attributes.desc.xp")).toBeTypeOf("string");
	});

	// HP, damage and armor spend their hover on provenance (where the number came from), which is the
	// more useful thing in play; this pins that split so a later edit doesn't quietly swap one for a
	// definition and lose the breakdown.
	it.each(["damage", "armor"])("keeps %s's hover on its provenance source", stat => {
		expect(template).toContain(`data-tooltip="{{stonetop.vitals.sources.${stat}}}"`);
	});

	it("keeps hit points' hover on its provenance source", () => {
		expect(advancement).toContain("tooltip=stonetop.vitals.sources.hp");
	});
});
