import { describe, it, expect } from "vitest";
import { FollowerLink } from "../../src/model/data/FollowerLink.js";

describe("FollowerLink.fromRaw", () => {
	it("parses the grouped shape", () => {
		const link = FollowerLink.fromRaw({ slugs: ["the-ring"], inlineDisplay: true, hideFromFollowersTab: true });
		expect(link.slugs).toEqual(["the-ring"]);
		expect(link.inlineDisplay).toBe(true);
		expect(link.hideFromFollowersTab).toBe(true);
	});

	it("defaults the presentation flags to false", () => {
		const link = FollowerLink.fromRaw({ slugs: ["enfys"] });
		expect(link.inlineDisplay).toBe(false);
		expect(link.hideFromFollowersTab).toBe(false);
	});

	it("returns null for null/undefined and for an empty or missing slugs list", () => {
		expect(FollowerLink.fromRaw(null)).toBeNull();
		expect(FollowerLink.fromRaw(undefined)).toBeNull();
		expect(FollowerLink.fromRaw({ slugs: [] })).toBeNull();
		expect(FollowerLink.fromRaw({ inlineDisplay: true })).toBeNull();
	});

	it("returns null for an unmigrated legacy slug array (migration owns the conversion)", () => {
		expect(FollowerLink.fromRaw(["enfys"])).toBeNull();
	});

	it("drops empty slug entries", () => {
		expect(FollowerLink.fromRaw({ slugs: ["", "enfys", null] }).slugs).toEqual(["enfys"]);
	});
});

describe("FollowerLink.toRaw", () => {
	it("round-trips through fromRaw", () => {
		const raw = { slugs: ["astor", "halix"], inlineDisplay: true, hideFromFollowersTab: false };
		expect(FollowerLink.fromRaw(raw).toRaw()).toEqual(raw);
	});
});
