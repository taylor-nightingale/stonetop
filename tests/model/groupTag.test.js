import { describe, it, expect } from "vitest";
import { normalizeGroupTags, isGroupTag, hasGroupTag, GROUP_TAG, HORDE_TAG } from "../../src/model/data/groupTag.js";

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

	// "Horde" is the book's larger-scale group tag (41 NPCs carry it: the wee folk, the Ghostly
	// Legion, caribou…). It normalizes like "Group" but keeps its own word — the scale it names is
	// part of the creature, so it is not folded into "group".
	it("normalizes 'Horde' to its own canonical token, not to 'group'", () => {
		expect(normalizeGroupTags(["Horde", "tiny", "fae"])).toEqual({ tags: [HORDE_TAG, "tiny", "fae"], count: null });
		expect(HORDE_TAG).not.toBe(GROUP_TAG);
	});

	it("surfaces a horde's '(N)' member count the same way a group's is", () => {
		expect(normalizeGroupTags(["Horde (6)"])).toEqual({ tags: ["horde"], count: 6 });
	});

	it("keeps a creature tagged both group and horde as two distinct tags", () => {
		expect(normalizeGroupTags(["Group", "horde"]).tags).toEqual(["group", "horde"]);
	});

	it("does not touch tags that merely start with 'horde'", () => {
		expect(normalizeGroupTags(["hordes", "goblin horde"]).tags).toEqual(["hordes", "goblin horde"]);
	});
});

describe("isGroupTag", () => {
	it("accepts either group tag in any casing or count form", () => {
		for (const tag of ["group", "Group", "GROUP  (2)", "horde", "Horde", "Horde (6)"]) {
			expect(isGroupTag(tag), tag).toBe(true);
		}
	});

	it("rejects a non-group tag, including near-misses and empties", () => {
		for (const tag of ["grouped", "wolf group", "hordes", "tiny", "", null, undefined]) {
			expect(isGroupTag(tag), String(tag)).toBe(false);
		}
	});
});

describe("hasGroupTag", () => {
	it("detects a group tag in a plain array or a Selection-shaped object", () => {
		expect(hasGroupTag(["tiny", "horde", "fae"])).toBe(true);
		expect(hasGroupTag({ values: ["large", "Group (3)"] })).toBe(true);
	});

	it("is false when no tag names a group", () => {
		expect(hasGroupTag(["tiny", "fae"])).toBe(false);
		expect(hasGroupTag({ values: [] })).toBe(false);
		expect(hasGroupTag(undefined)).toBe(false);
	});
});
