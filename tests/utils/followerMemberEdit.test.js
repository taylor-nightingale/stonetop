import { describe, it, expect } from "vitest";
import * as ME from "../../src/utils/followerMemberEdit.js";

describe("followerMemberEdit", () => {
	it("newMember starts at the group's shared max HP with empty tag/trait lists", () => {
		const m = ME.newMember(6);
		expect(m).toMatchObject({ name: "", hp: { value: 6, max: 6 } });
		// tags/traits are token lists — same shape CharacterFollowers stores.
		expect(m.tags).toEqual([]);
		expect(m.traits).toEqual([]);
	});

	it("setMemberListField stores tags/traits as a token list parsed from CSV", () => {
		const list = [ME.newMember(6)];
		const next = ME.setMemberListField(list, { index: 0, field: "tags", csv: "big, brave" });
		expect(next[0].tags).toEqual(["big", "brave"]);
		expect(list[0].tags).toEqual([]); // input untouched
	});

	it("addMember appends a new member without mutating the input", () => {
		const list = [];
		const next = ME.addMember(list, 5);
		expect(next).toHaveLength(1);
		expect(next[0].hp).toEqual({ value: 5, max: 5 });
		expect(list).toHaveLength(0);
	});

	it("removeMember drops the member at index", () => {
		const list = [{ name: "A" }, { name: "B" }];
		expect(ME.removeMember(list, 0)).toEqual([{ name: "B" }]);
		expect(list).toHaveLength(2);
	});

	it("moveMember swaps neighbours and is a no-op at the ends", () => {
		const list = [{ name: "A" }, { name: "B" }];
		expect(ME.moveMember(list, 0, 1).map(m => m.name)).toEqual(["B", "A"]);
		expect(ME.moveMember(list, 0, -1).map(m => m.name)).toEqual(["A", "B"]);
		expect(ME.moveMember(list, 1, 1).map(m => m.name)).toEqual(["A", "B"]);
	});

	it("setMemberField sets a dotted field on the target member", () => {
		const list = [{ name: "", hp: { value: 6, max: 6 }, tags: [], traits: [] }];
		expect(ME.setMemberField(list, { index: 0, field: "hp.max", value: 9 })[0].hp.max).toBe(9);
		expect(ME.setMemberField(list, { index: 0, field: "tags", value: ["big"] })[0].tags).toEqual(["big"]);
		expect(list[0].hp.max).toBe(6);
	});
});
