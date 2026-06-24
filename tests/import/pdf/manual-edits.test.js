import { describe, it, expect } from "vitest";
import { applyManualEdits, MANUAL_EDITS } from "../../../scripts/import/pdf/manual-edits.js";

describe("applyManualEdits", () => {
	it("returns the html unchanged for an article with no edits", () => {
		const { html, applied, misses } = applyManualEdits("<p>hello</p>", "no-such-article");
		expect(html).toBe("<p>hello</p>");
		expect(applied).toBe(0);
		expect(misses).toEqual([]);
	});

	it("applies literal-string and regex edits, and reports a find that matched nothing", () => {
		const slug = "__test__";
		MANUAL_EDITS[slug] = [
			{ find: "nurs-eries", replace: "nurseries", note: "de-hyphen" },
			{ find: /\s+to his bones/, replace: " to his bones", note: "newline" },
			{ find: "NOPE", replace: "x", note: "stale edit" },
		];
		try {
			const { html, applied, misses } = applyManualEdits("the nurs-eries and\n to his bones", slug);
			expect(html).toBe("the nurseries and to his bones");
			expect(applied).toBe(2);
			expect(misses).toEqual(["stale edit"]);
		} finally {
			delete MANUAL_EDITS[slug];
		}
	});
});
