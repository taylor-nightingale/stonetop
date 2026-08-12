import { describe, it, expect } from "vitest";
import { applyManualEdits, applyArcanaEdits, MANUAL_EDITS, ARCANA_EDITS } from "../../../scripts/import/pdf/manual-edits.js";

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

describe("applyArcanaEdits", () => {
	it("returns the system untouched for an arcanum with no edits", () => {
		const system = { front: { choices: [] } };
		const { system: out, misses } = applyArcanaEdits(system, "no-edits-here");
		expect(out).toBe(system);
		expect(misses).toEqual([]);
	});

	it("corrects every string in the system and reports a find that matched nothing", () => {
		const slug = "__test__";
		ARCANA_EDITS[slug] = [
			{ find: "exquisitly", replace: "exquisitely", note: "book typo" },
			{ find: "NOPE", replace: "x", note: "stale edit" },
		];
		try {
			const { system, misses } = applyArcanaEdits({
				front: { choices: [{ list: [{ content: { title: null, text: "An exquisitly fine wool." } }] }] },
				back: { title: "An exquisitly Cloak", resource: { max: 3 } },
			}, slug);
			expect(system.front.choices[0].list[0].content.text).toBe("An exquisitely fine wool.");
			expect(system.back.title).toBe("An exquisitely Cloak");   // the same edit may hit front and back
			expect(system.back.resource.max).toBe(3);                 // non-string values pass through
			expect(misses).toEqual(["stale edit"]);
		} finally {
			delete ARCANA_EDITS[slug];
		}
	});
});
