import { describe, expect, it } from "vitest";
import { MoveData } from "../../src/data/MoveData.js";

function migrate(choices) {
	return MoveData.migrateData({ choices }).choices;
}

describe("MoveData.migrateData — null / missing choices", () => {
	it("leaves null choices alone", () => {
		expect(MoveData.migrateData({ choices: null }).choices).toBeNull();
	});

	it("leaves missing choices alone", () => {
		const result = MoveData.migrateData({});
		expect(result.choices).toBeUndefined();
	});

	it("leaves choices with no list alone", () => {
		const choices = { slug: "choices" };
		expect(migrate(choices)).toEqual({ slug: "choices" });
	});
});

describe("MoveData.migrateData — heading rows", () => {
	it("converts type:heading to type:entry", () => {
		const result = migrate({ slug: "choices", list: [{ type: "heading", slug: "h1" }] });
		expect(result.list[0].type).toBe("entry");
	});

	it("preserves all other heading row fields (note folds into content.titleNote)", () => {
		const row = { type: "heading", slug: "h1", note: "a note", track: null };
		const result = migrate({ slug: "choices", list: [row] });
		expect(result.list[0]).toMatchObject({ type: "entry", slug: "h1", track: null });
		expect(result.list[0].content.titleNote).toBe("a note");
		expect(result.list[0].note).toBeUndefined();
	});
});

describe("MoveData.migrateData — follower rows", () => {
	it("converts type:follower to type:entry", () => {
		const result = migrate({ slug: "choices", list: [{ type: "follower", slug: "adra", title: "Adra" }] });
		expect(result.list[0].type).toBe("entry");
	});

	it("adds followers array with the row slug", () => {
		const result = migrate({ slug: "choices", list: [{ type: "follower", slug: "adra", title: "Adra" }] });
		expect(result.list[0].followers).toEqual(["adra"]);
	});

	it("moves title into content.text", () => {
		const result = migrate({ slug: "choices", list: [{ type: "follower", slug: "adra", title: "Adra" }] });
		expect(result.list[0].content.text).toBe("Adra");
		expect(result.list[0].title).toBeUndefined();
	});

	it("leaves content.text unset when title is missing", () => {
		const result = migrate({ slug: "choices", list: [{ type: "follower", slug: "adra" }] });
		expect(result.list[0].content.text).toBeUndefined();
	});
});

describe("MoveData.migrateData — pass-through rows", () => {
	it("passes through entry rows unchanged", () => {
		const row = { type: "entry", slug: "s1", content: { title: null, text: "Go do the thing" } };
		expect(migrate({ slug: "choices", list: [row] }).list[0]).toEqual(row);
	});

	it("passes through pick rows unchanged", () => {
		const row = { type: "pick", pickCount: 1, options: [{ slug: "opt-a", content: { title: "A", text: null } }] };
		expect(migrate({ slug: "choices", list: [row] }).list[0]).toEqual(row);
	});
});

describe("MoveData.migrateData — mixed list", () => {
	it("migrates heading and follower rows while leaving entry rows unchanged", () => {
		const result = migrate({
			slug: "choices",
			list: [
				{ type: "heading", slug: "h1" },
				{ type: "entry", slug: "e1", content: { title: null, text: "Stay" } },
				{ type: "follower", slug: "adra", title: "Adra" },
			],
		});
		expect(result.list[0].type).toBe("entry");
		expect(result.list[1]).toEqual({ type: "entry", slug: "e1", content: { title: null, text: "Stay" } });
		expect(result.list[2].type).toBe("entry");
		expect(result.list[2].followers).toEqual(["adra"]);
	});
});
