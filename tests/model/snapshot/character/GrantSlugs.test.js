import { describe, it, expect } from "vitest";
import { collectGrantSlugs, GrantSlugs } from "../../../../src/model/snapshot/character/GrantSlugs.js";
import { buildChoiceGroup } from "../../../../src/model/snapshot/character/buildChoiceGroup.js";

const entry = (slug, grants) => ({ type: "entry", slug, content: {}, grants });
const group = (slug, list) => buildChoiceGroup({ slug, list });

describe("collectGrantSlugs", () => {
	it("gathers inline move + follower grant slugs across groups", () => {
		const groups = [
			group("moves", [
				entry("clash", [{ type: "move", slug: "clash", locations: ["inline"] }]),
				entry("hex",   [{ type: "move", slug: "hex",   locations: ["inline"] }]),
			]),
			group("bound", [
				entry("ring", [{ type: "follower", slug: "the-ring", locations: ["inline"] }]),
			]),
		];
		const slugs = collectGrantSlugs(groups);
		expect(slugs).toBeInstanceOf(GrantSlugs);
		expect(slugs.moveSlugs).toEqual(["clash", "hex"]);
		expect(slugs.followerSlugs).toEqual(["the-ring"]);
		expect(slugs.isEmpty).toBe(false);
	});

	it("dedupes slugs granted from more than one row", () => {
		const groups = [group("g", [
			entry("a", [{ type: "move", slug: "clash", locations: ["inline"] }]),
			entry("b", [{ type: "move", slug: "clash", locations: ["inline"] }]),
		])];
		expect(collectGrantSlugs(groups).moveSlugs).toEqual(["clash"]);
	});

	it("is empty for groups with no grants, and tolerates missing input", () => {
		expect(collectGrantSlugs([group("g", [entry("plain", [])])]).isEmpty).toBe(true);
		expect(collectGrantSlugs([]).isEmpty).toBe(true);
		expect(collectGrantSlugs().isEmpty).toBe(true);
		expect(collectGrantSlugs([null, { list: null }]).isEmpty).toBe(true);
	});
});
