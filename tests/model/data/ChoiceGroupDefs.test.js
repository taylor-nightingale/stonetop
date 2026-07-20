import { describe, it, expect } from "vitest";
import { ChoiceGroupDefs } from "../../../src/model/data/ChoiceGroupDefs.js";

// Choice groups are found by SHAPE ({slug, list}) rather than by a hand-maintained list of paths, so a
// group added anywhere — including on an item a user authored in Foundry — is discovered with no new
// code. These tests pin the shapes that actually occur in pack data.

const group = (slug, ...rows) => ({ slug, list: rows });
const entry = (slug, extra = {}) => ({ type: "entry", slug, ...extra });
const pick  = (...options) => ({ type: "pick", pickCount: 1, options });

const ARCANUM = {
	slug: "ring-of-daagon",
	front: { unlock: group("ring-of-daagon", entry("the-ring", { followers: { slugs: ["the-ring"] } })) },
	back:  {
		choices:      group("ring-back", entry("a")),
		consequences: group("ring-consequences", entry("b")),
	},
};

const PLAYBOOK = {
	instinct:    group("instinct", entry("guide")),
	appearance:  group("appearance", entry("weathered")),
	backgrounds: [{ slug: "outsider", choices: group("outsider", entry("x")) }],
};

describe("ChoiceGroupDefs.findAll", () => {
	it("finds all three arcanum groups, wherever they sit", () => {
		expect(ChoiceGroupDefs.findAll(ARCANUM).map(d => d.slug).sort())
			.toEqual(["ring-back", "ring-consequences", "ring-of-daagon"]);
	});

	it("records the path each group was found at", () => {
		const paths = Object.fromEntries(ChoiceGroupDefs.findAll(ARCANUM).map(d => [d.slug, d.path]));
		expect(paths["ring-of-daagon"]).toBe("front.unlock");
		expect(paths["ring-consequences"]).toBe("back.consequences");
	});

	it("finds groups nested inside an array", () => {
		const found = ChoiceGroupDefs.findAll(PLAYBOOK);
		expect(found.map(d => d.slug).sort()).toEqual(["appearance", "instinct", "outsider"]);
		expect(found.find(d => d.slug === "outsider").path).toBe("backgrounds.0.choices");
	});

	it("does not mistake rows or pick options for groups (they have a slug but no list)", () => {
		const found = ChoiceGroupDefs.findAll({
			choices: group("ns", entry("row"), pick({ slug: "opt", text: "Opt" })),
		});
		expect(found.map(d => d.slug)).toEqual(["ns"]);
	});

	it("returns nothing for data with no choice groups", () => {
		expect(ChoiceGroupDefs.findAll({ name: "plain", hp: { value: 1 } })).toEqual([]);
		expect(ChoiceGroupDefs.findAll(null)).toEqual([]);
	});
});

describe("ChoiceGroupDefs.findBySlug", () => {
	it("finds a group the hand-written lookup never knew about (front.unlock)", () => {
		expect(ChoiceGroupDefs.findBySlug(ARCANUM, "ring-of-daagon").path).toBe("front.unlock");
	});

	it("returns null when nothing matches", () => {
		expect(ChoiceGroupDefs.findBySlug(ARCANUM, "nope")).toBeNull();
	});
});

describe("ChoiceGroupDefs.followerLinks", () => {
	it("parses follower links from rows in any group", () => {
		const links = ChoiceGroupDefs.followerLinks(ARCANUM);
		expect(links.flatMap(l => l.slugs)).toEqual(["the-ring"]);
	});

	it("ignores rows with no follower link", () => {
		expect(ChoiceGroupDefs.followerLinks(PLAYBOOK)).toEqual([]);
	});
});
