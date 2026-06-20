import { describe, it, expect } from "vitest";
import { newMove, addMove, removeMove, moveMove, setMoveField, toggleTracker } from "../../src/utils/arcanumMoveEdit.js";

describe("arcanumMoveEdit", () => {
	it("newMove makes a blank move with a generated id and no tracker", () => {
		const m = newMove();
		expect(m).toMatchObject({ name: "", subtitle: null, tracker: null, text: "", followerSlug: null });
		expect(m.id).toMatch(/^move-/);
	});

	it("addMove appends a blank move without mutating the input", () => {
		const before = [];
		const after = addMove(before);
		expect(before).toHaveLength(0);
		expect(after).toHaveLength(1);
		expect(after[0].id).toMatch(/^move-/);
	});

	it("removeMove drops the move at the index", () => {
		const list = [newMove(), newMove(), newMove()];
		expect(removeMove(list, 1)).toHaveLength(2);
	});

	it("moveMove reorders; no-op at the edges", () => {
		const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
		expect(moveMove(list, 0, -1).map(m => m.id)).toEqual(["a", "b", "c"]); // edge no-op
		expect(moveMove(list, 0, 1).map(m => m.id)).toEqual(["b", "a", "c"]);
	});

	it("setMoveField writes a (dotted) field on one move, returning a clone", () => {
		const list = [newMove()];
		const out = setMoveField(list, { index: 0, field: "name", value: "Battery" });
		expect(out[0].name).toBe("Battery");
		expect(list[0].name).toBe(""); // input untouched

		const out2 = setMoveField(toggleTracker(list, 0), { index: 0, field: "tracker.max", value: 4 });
		expect(out2[0].tracker.max).toBe(4);
	});

	it("toggleTracker flips a {label,max} tracker on then off", () => {
		let list = [newMove()];
		list = toggleTracker(list, 0);
		expect(list[0].tracker).toEqual({ label: "", max: 1 });
		expect(toggleTracker(list, 0)[0].tracker).toBeNull();
	});
});
