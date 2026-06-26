import { describe, it, expect } from "vitest";
import { ordinal, ordinalWord, mergeSeasonBlock } from "../../module/seasons/seasons-chronicle.js";

// Minimal stand-ins for the wrapped blocks recordSeasonsChange writes — only the
// `<section data-season>` marker matters to the merge.
const block = (season, body = "") => `<section class="stonetop-season-block" data-season="${season}"><h2>${season}</h2>${body}</section>`;

describe("ordinal", () => {
	it("uses st/nd/rd for 1–3", () => {
		expect(ordinal(1)).toBe("1st");
		expect(ordinal(2)).toBe("2nd");
		expect(ordinal(3)).toBe("3rd");
	});

	it("uses th for 4–9 and 0", () => {
		expect(ordinal(4)).toBe("4th");
		expect(ordinal(9)).toBe("9th");
	});

	it("uses th for the 11–13 exception", () => {
		expect(ordinal(11)).toBe("11th");
		expect(ordinal(12)).toBe("12th");
		expect(ordinal(13)).toBe("13th");
	});

	it("uses st/nd/rd again for 21–23 and 101", () => {
		expect(ordinal(21)).toBe("21st");
		expect(ordinal(22)).toBe("22nd");
		expect(ordinal(23)).toBe("23rd");
		expect(ordinal(101)).toBe("101st");
		expect(ordinal(111)).toBe("111th");
	});
});

describe("ordinalWord", () => {
	it("spells out the year for small numbers", () => {
		expect(ordinalWord(1)).toBe("First");
		expect(ordinalWord(2)).toBe("Second");
		expect(ordinalWord(3)).toBe("Third");
		expect(ordinalWord(10)).toBe("Tenth");
		expect(ordinalWord(20)).toBe("Twentieth");
	});

	it("falls back to the numeric ordinal past twenty", () => {
		expect(ordinalWord(21)).toBe("21st");
		expect(ordinalWord(22)).toBe("22nd");
		expect(ordinalWord(100)).toBe("100th");
	});
});

describe("mergeSeasonBlock", () => {
	it("appends a season that isn't on the page yet", () => {
		const merged = mergeSeasonBlock(block("spring"), "summer", block("summer", "<p>warm</p>"));
		expect(merged).toBe(block("spring") + block("summer", "<p>warm</p>"));
	});

	it("replaces an earlier block for the same season instead of duplicating it", () => {
		const existing = block("spring", "<p>old</p>");
		const merged   = mergeSeasonBlock(existing, "spring", block("spring", "<p>new</p>"));
		expect(merged).toBe(block("spring", "<p>new</p>"));
		expect(merged).not.toContain("old");
		// Exactly one Spring block remains.
		expect(merged.match(/data-season="spring"/g)).toHaveLength(1);
	});

	it("re-emits blocks in canonical season order regardless of insertion order", () => {
		let html = "";
		html = mergeSeasonBlock(html, "winter", block("winter"));
		html = mergeSeasonBlock(html, "spring", block("spring"));
		html = mergeSeasonBlock(html, "autumn", block("autumn"));
		html = mergeSeasonBlock(html, "summer", block("summer"));
		expect(html).toBe(block("spring") + block("summer") + block("autumn") + block("winter"));
	});

	it("starts a fresh page from empty content", () => {
		expect(mergeSeasonBlock("", "spring", block("spring"))).toBe(block("spring"));
	});
});
