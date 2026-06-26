import { describe, it, expect } from "vitest";
import { findMonsterTag, MONSTER_TAGS } from "../../module/data/monster-tags.js";

describe("findMonsterTag", () => {
	it("looks up tags case- and whitespace-insensitively", () => {
		expect(findMonsterTag("Terrifying")).toBe(MONSTER_TAGS.terrifying);
		expect(findMonsterTag("  SOLITARY ")).toBe(MONSTER_TAGS.solitary);
	});

	it("returns null for unknown / flavor tags and empty input", () => {
		expect(findMonsterTag("grumpy")).toBeNull();
		expect(findMonsterTag("")).toBeNull();
		expect(findMonsterTag(null)).toBeNull();
		expect(findMonsterTag(undefined)).toBeNull();
	});

	it("covers the organization and size terms", () => {
		for (const term of ["solitary", "group", "horde", "tiny", "small", "large", "huge"]) {
			expect(findMonsterTag(term)).toBeTypeOf("string");
		}
	});
});
