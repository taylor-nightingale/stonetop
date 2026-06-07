import { describe, expect, it } from "vitest";
import { migrateGroupDefs } from "../../src/migration/migrateCharacter.js";

describe("migrateGroupDefs — null / empty", () => {
	it("returns {} for null input", () => {
		expect(migrateGroupDefs(null)).toEqual({});
	});
	it("returns {} for empty object", () => {
		expect(migrateGroupDefs({})).toEqual({});
	});
});

describe("migrateGroupDefs — heading rows", () => {
	it("converts type:heading to type:entry", () => {
		const defs = {
			"instinct": {
				list: [{ slug: "the-call", type: "heading", title: "The Call" }],
			},
		};
		const result = migrateGroupDefs(defs);
		expect(result["instinct"].list[0].type).toBe("entry");
	});

	it("preserves all other heading row fields", () => {
		const defs = {
			"instinct": {
				list: [{ slug: "the-call", type: "heading", title: "The Call", note: "a note" }],
			},
		};
		const result = migrateGroupDefs(defs);
		expect(result["instinct"].list[0].slug).toBe("the-call");
		expect(result["instinct"].list[0].note).toBe("a note");
	});
});

describe("migrateGroupDefs — follower rows", () => {
	it("converts type:follower to type:entry", () => {
		const defs = {
			"background": {
				list: [{ slug: "adra", type: "follower", title: "Adra" }],
			},
		};
		const result = migrateGroupDefs(defs);
		expect(result["background"].list[0].type).toBe("entry");
	});

	it("adds followers array containing the row's slug", () => {
		const defs = {
			"background": {
				list: [{ slug: "adra", type: "follower", title: "Adra" }],
			},
		};
		const result = migrateGroupDefs(defs);
		expect(result["background"].list[0].followers).toEqual(["adra"]);
	});

	it("moves title into content.text", () => {
		const defs = {
			"background": {
				list: [{ slug: "adra", type: "follower", title: "Adra" }],
			},
		};
		const result = migrateGroupDefs(defs);
		expect(result["background"].list[0].content).toEqual({ title: null, text: "Adra" });
	});

	it("uses empty string for content.text when title is missing", () => {
		const defs = {
			"background": {
				list: [{ slug: "adra", type: "follower" }],
			},
		};
		const result = migrateGroupDefs(defs);
		expect(result["background"].list[0].content).toEqual({ title: null, text: "" });
	});
});

describe("migrateGroupDefs — entry/pick rows", () => {
	it("passes through type:entry rows unchanged", () => {
		const row = { slug: "the-call", type: "entry", content: { text: "The Call" } };
		const defs = { "instinct": { list: [row] } };
		expect(migrateGroupDefs(defs)["instinct"].list[0]).toEqual(row);
	});

	it("passes through pick rows (no type field) unchanged", () => {
		const row = { slug: "opt-a", options: [{ slug: "opt-1", text: "Option 1" }] };
		const defs = { "instinct": { list: [row] } };
		expect(migrateGroupDefs(defs)["instinct"].list[0]).toEqual(row);
	});
});

describe("migrateGroupDefs — multiple namespaces and rows", () => {
	it("migrates across multiple namespaces independently", () => {
		const defs = {
			"instinct": { list: [{ slug: "a", type: "heading" }] },
			"background": { list: [{ slug: "b", type: "follower", title: "B" }] },
		};
		const result = migrateGroupDefs(defs);
		expect(result["instinct"].list[0].type).toBe("entry");
		expect(result["background"].list[0].type).toBe("entry");
		expect(result["background"].list[0].followers).toEqual(["b"]);
	});
});
