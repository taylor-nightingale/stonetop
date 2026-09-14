import { describe, it, expect } from "vitest";
import { Background } from "../../../../src/model/data/character/Background.js";

const INITIATE = {
	slug:  "initiate",
	label: "Initiate",
	moves: ["rites-of-the-land"],
	choices: {
		slug: "initiate",
		list: [
			{ slug: "enfys", type: "entry", track: { max: 1 }, content: { text: "Enfys" },
				grants: [{ type: "follower", slug: "enfys", locations: ["tab"] }] },
			{ type: "entry", grants: [{ type: "move", slug: "danus-grasp", locations: ["inline"] }] },
		],
	},
};

const VESSEL = { slug: "vessel", label: "Vessel", moves: ["channel"] };

const PLAYBOOK = { slug: "the-blessed", backgrounds: [INITIATE, VESSEL] };

describe("Background.find", () => {
	it("finds a background by slug", () => {
		expect(Background.find(PLAYBOOK, "vessel").label).toBe("Vessel");
	});

	it("returns null for a slug the playbook doesn't have", () => {
		expect(Background.find(PLAYBOOK, "prophet")).toBeNull();
	});

	it("returns null for an empty slug", () => {
		expect(Background.find(PLAYBOOK, "")).toBeNull();
	});

	it("returns null when the playbook has no backgrounds", () => {
		expect(Background.find({ slug: "the-fox" }, "vessel")).toBeNull();
		expect(Background.find(null, "vessel")).toBeNull();
	});
});

describe("Background.allFrom", () => {
	it("wraps every background", () => {
		expect(Background.allFrom(PLAYBOOK).map(b => b.slug)).toEqual(["initiate", "vessel"]);
	});

	it("is empty when there are none", () => {
		expect(Background.allFrom(null)).toEqual([]);
		expect(Background.allFrom({ slug: "the-fox" })).toEqual([]);
	});
});

describe("Background.of", () => {
	it("wraps a raw def", () => {
		expect(Background.of(VESSEL).slug).toBe("vessel");
	});

	it("passes null through", () => {
		expect(Background.of(null)).toBeNull();
		expect(Background.of(undefined)).toBeNull();
	});
});

describe("Background.categoryKeyFor", () => {
	it("prefixes the slug", () => {
		expect(Background.categoryKeyFor("destined")).toBe("background-destined");
	});

	it("agrees with an instance's own categoryKey", () => {
		expect(Background.of(VESSEL).categoryKey).toBe(Background.categoryKeyFor("vessel"));
	});
});

describe("Background fields", () => {
	it("reads slug, label and the playbook moves it acquires", () => {
		const background = Background.of(INITIATE);
		expect(background.slug).toBe("initiate");
		expect(background.label).toBe("Initiate");
		expect(background.moveSlugs).toEqual(["rites-of-the-land"]);
	});

	it("defaults every field on a background that declares none", () => {
		const background = new Background({});
		expect(background.slug).toBeNull();
		expect(background.label).toBeNull();
		expect(background.moveSlugs).toEqual([]);
		expect(background.grantedMoveSlugs).toEqual([]);
	});
});

describe("Background.grantedMoveSlugs", () => {
	it("collects the move grants out of the choice group, ignoring other grant types", () => {
		expect(Background.of(INITIATE).grantedMoveSlugs).toEqual(["danus-grasp"]);
	});

	it("is empty for a background with no choice group", () => {
		expect(Background.of(VESSEL).grantedMoveSlugs).toEqual([]);
	});

	// The shape the-judge's `prophet` carried until it was corrected: a bare array of rows instead of
	// a {slug, list} group. ChoiceGroupDefs can't see it, so the grant silently vanishes — the reason
	// no migration could recover Commune with Aratis.
	it("finds nothing in a choices value that is not a group", () => {
		const malformed = { slug: "prophet", choices: [
			{ type: "entry", grants: [{ type: "move", slug: "commune-with-aratis", locations: ["inline"] }] },
		] };
		expect(Background.of(malformed).grantedMoveSlugs).toEqual([]);
	});
});
