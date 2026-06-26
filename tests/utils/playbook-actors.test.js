import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { playbookSlug, getPlayerCharacters, playbookIconPath } from "../../module/utils/playbook-actors.js";

// Shared "player character" helpers. The logic worth guarding is the slug lookup
// (embedded data vs. a contained playbook item vs. none) and the PC filter that
// the Introductions / Spring-Burst walkthroughs and the playbook picker all rely
// on. Pure functions over plain objects — no DOM needed; only getPlayerCharacters
// touches the `game.actors` global.

describe("playbookSlug", () => {
	it("reads the embedded system.playbook slug", () => {
		expect(playbookSlug({ system: { playbook: { slug: "the-blessed" } } })).toBe("the-blessed");
	});

	it("falls back to a contained playbook item's slug", () => {
		const actor = { items: [{ type: "move" }, { type: "playbook", system: { slug: "the-fox" } }] };
		expect(playbookSlug(actor)).toBe("the-fox");
	});

	it("returns \"\" (falsy) when there's no playbook", () => {
		expect(playbookSlug({ system: {}, items: [] })).toBe("");
		expect(playbookSlug(null)).toBe("");
		expect(playbookSlug(undefined)).toBe("");
	});
});

describe("playbookIconPath", () => {
	it("maps a slug to its avatar art, underscoring the hyphens", () => {
		expect(playbookIconPath("the-would-be-hero"))
			.toBe("systems/stonetop/assets/icons/playbooks/the_would_be_hero_icon.webp");
	});

	it("returns null for a slug-less actor", () => {
		expect(playbookIconPath("")).toBe(null);
		expect(playbookIconPath(null)).toBe(null);
	});

	it("is server-root-relative (no leading slash) so it matches the stored avatar", () => {
		expect(playbookIconPath("the-fox").startsWith("systems/")).toBe(true);
	});
});

describe("getPlayerCharacters", () => {
	afterEach(() => { delete global.game; });

	it("keeps only characters that carry a playbook", () => {
		global.game = {
			actors: {
				contents: [
					{ type: "character", system: { playbook: { slug: "the-blessed" } } }, // PC
					{ type: "character", system: {}, items: [] },                          // blank sheet, no playbook
					{ type: "monster",   system: { playbook: { slug: "x" } } },            // not a character
					{ type: "character", items: [{ type: "playbook", system: { slug: "the-heavy" } }] }, // PC via item
				],
			},
		};
		const pcs = getPlayerCharacters();
		expect(pcs.map(a => playbookSlug(a))).toEqual(["the-blessed", "the-heavy"]);
	});

	it("is empty when there are no actors", () => {
		global.game = { actors: {} };
		expect(getPlayerCharacters()).toEqual([]);
	});
});
