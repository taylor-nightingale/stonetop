import { describe, it, expect } from "vitest";
import { Grant, GrantList } from "../../src/model/data/Grant.js";

describe("Grant", () => {
	it("exposes type/slug/locations and location helpers", () => {
		const g = new Grant({ type: "follower", slug: "the-ring", locations: ["inline", "tab"] });
		expect(g.type).toBe("follower");
		expect(g.slug).toBe("the-ring");
		expect(g.has("inline")).toBe(true);
		expect(g.inline).toBe(true);
		expect(g.onTab).toBe(true);
	});
	it("defaults locations to an empty array (nothing shown)", () => {
		const g = new Grant({ type: "move", slug: "battery" });
		expect(g.locations).toEqual([]);
		expect(g.inline).toBe(false);
		expect(g.onTab).toBe(false);
	});
	it("round-trips through toRaw", () => {
		const raw = { type: "move", slug: "battery", locations: ["inline"] };
		expect(new Grant(raw).toRaw()).toEqual(raw);
	});
});

describe("GrantList.fromRaw", () => {
	it("parses an array of grants", () => {
		const list = GrantList.fromRaw([
			{ type: "follower", slug: "astor", locations: ["inline", "tab"] },
			{ type: "move", slug: "call-forth", locations: ["inline"] },
		]);
		expect(list.grants).toHaveLength(2);
		expect(list.slugsOfType("follower")).toEqual(["astor"]);
		expect(list.ofType("move")[0].slug).toBe("call-forth");
	});
	it("returns an empty list for a non-array (null/object/legacy)", () => {
		expect(GrantList.fromRaw(null).isEmpty).toBe(true);
		expect(GrantList.fromRaw({ slugs: ["x"] }).isEmpty).toBe(true);
	});
	it("skips malformed entries (missing type or slug)", () => {
		const list = GrantList.fromRaw([{ slug: "x" }, { type: "move" }, { type: "follower", slug: "ok" }]);
		expect(list.slugsOfType("follower")).toEqual(["ok"]);
	});
});

describe("GrantList.followerGrantsFromLink (legacy migration)", () => {
	it("inline + on-tab link → one follower grant per slug with both locations", () => {
		const grants = GrantList.followerGrantsFromLink({ slugs: ["a", "b"], inlineDisplay: true, hideFromFollowersTab: false });
		expect(grants.map(g => g.slug)).toEqual(["a", "b"]);
		expect(grants[0].locations).toEqual(["inline", "tab"]);
	});
	it("card-bound follower (hideFromFollowersTab) drops the tab location", () => {
		const [g] = GrantList.followerGrantsFromLink({ slugs: ["the-ring"], inlineDisplay: true, hideFromFollowersTab: true });
		expect(g.locations).toEqual(["inline"]);
		expect(g.onTab).toBe(false);
	});
	it("non-inline, on-tab link → tab only", () => {
		const [g] = GrantList.followerGrantsFromLink({ slugs: ["enfys"] });
		expect(g.locations).toEqual(["tab"]);
	});
	it("no slugs → no grants", () => {
		expect(GrantList.followerGrantsFromLink({ slugs: [] })).toEqual([]);
		expect(GrantList.followerGrantsFromLink(null)).toEqual([]);
	});
});
