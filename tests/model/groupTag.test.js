import { describe, it, expect } from "vitest";
import { normalizeGroupTags, GROUP_TAG } from "../../src/model/data/groupTag.js";

describe("normalizeGroupTags", () => {
	it("rewrites a counted 'Group (3)' to the canonical token and surfaces the count", () => {
		const { tags, count } = normalizeGroupTags(["Group (3)", "spirit", "undead"]);
		expect(tags).toEqual([GROUP_TAG, "spirit", "undead"]);
		expect(count).toBe(3);
	});

	it("rewrites a bare capitalized 'Group' with no count", () => {
		const { tags, count } = normalizeGroupTags(["large", "Group", "beast"]);
		expect(tags).toEqual(["large", "group", "beast"]);
		expect(count).toBeNull();
	});

	it("leaves an already-canonical 'group' unchanged", () => {
		const { tags, count } = normalizeGroupTags(["group", "brave"]);
		expect(tags).toEqual(["group", "brave"]);
		expect(count).toBeNull();
	});

	it("collapses a duplicate 'Group' + 'group' to a single canonical token, keeping the count", () => {
		const { tags, count } = normalizeGroupTags(["Group (5)", "sly", "group"]);
		expect(tags).toEqual(["group", "sly"]);
		expect(count).toBe(5);
	});

	it("is case-insensitive and tolerates whitespace in the count", () => {
		expect(normalizeGroupTags(["GROUP  (2)"])).toEqual({ tags: ["group"], count: 2 });
	});

	it("does not touch tags that merely start with 'group'", () => {
		const { tags, count } = normalizeGroupTags(["grouped", "wolf group"]);
		expect(tags).toEqual(["grouped", "wolf group"]);
		expect(count).toBeNull();
	});

	it("returns an empty list and null count for no tags", () => {
		expect(normalizeGroupTags()).toEqual({ tags: [], count: null });
	});
});
