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

	describe("row inserts", () => {
		const slug = "__test__";
		const pips = { type: "entry", slug: "c1-pips", content: { title: null, text: "Pips" }, track: { max: 3 }, indent: true };
		const system = () => ({
			front: { choices: [{ slug: "front", list: [{ type: "entry", slug: "marks", track: { max: 5 } }] }] },
			back: { choices: [{ slug: "consequences", list: [
				{ type: "entry", slug: "c1", track: { max: 1 } },
				{ type: "entry", slug: "c2", track: { max: 1 } },
			] }] },
		});
		const slugsOf = (sys) => sys.back.choices[0].list.map((r) => r.slug);

		it("puts the row straight after the row with that slug, without touching the input", () => {
			ARCANA_EDITS[slug] = [{ insertAfter: "c1", row: pips, note: "pips" }];
			try {
				const input = system();
				const { system: out, misses } = applyArcanaEdits(input, slug);
				expect(slugsOf(out)).toEqual(["c1", "c1-pips", "c2"]);
				expect(out.back.choices[0].list[1]).toEqual(pips);
				expect(out.back.choices[0].list[1]).not.toBe(pips);
				expect(slugsOf(input)).toEqual(["c1", "c2"]);
				expect(misses).toEqual([]);
			} finally {
				delete ARCANA_EDITS[slug];
			}
		});

		it("reports an insert whose anchor row is missing", () => {
			ARCANA_EDITS[slug] = [{ insertAfter: "c9", row: pips, note: "stale insert" }];
			try {
				const { system: out, misses } = applyArcanaEdits(system(), slug);
				expect(slugsOf(out)).toEqual(["c1", "c2"]);
				expect(misses).toEqual(["stale insert"]);
			} finally {
				delete ARCANA_EDITS[slug];
			}
		});

		it("does not add the row again when it is already there", () => {
			ARCANA_EDITS[slug] = [{ insertAfter: "c1", row: pips, note: "pips" }];
			try {
				const once = applyArcanaEdits(system(), slug).system;
				const { system: twice, misses } = applyArcanaEdits(once, slug);
				expect(slugsOf(twice)).toEqual(["c1", "c1-pips", "c2"]);
				expect(misses).toEqual([]);
			} finally {
				delete ARCANA_EDITS[slug];
			}
		});

		it("leaves text edits working alongside an insert", () => {
			ARCANA_EDITS[slug] = [
				{ find: "Pips", replace: "Dots", note: "text" },
				{ insertAfter: "c1", row: pips, note: "pips" },
			];
			try {
				const input = system();
				input.back.choices[0].list[0].content = { title: null, text: "Pips here" };
				const { system: out, misses } = applyArcanaEdits(input, slug);
				expect(out.back.choices[0].list[0].content.text).toBe("Dots here");
				expect(out.back.choices[0].list[1].content.text).toBe("Pips");   // the inserted row is authored as-is
				expect(misses).toEqual([]);
			} finally {
				delete ARCANA_EDITS[slug];
			}
		});
	});
});
