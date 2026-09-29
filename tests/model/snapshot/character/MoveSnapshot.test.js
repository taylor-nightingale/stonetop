import { describe, it, expect } from "vitest";
import { MoveSnapshotBuilder, MoveCategorySnapshot, MoveCategorySnapshotBuilder, ValueMax } from "../../../../src/model/snapshot/character/MoveSnapshot.js";

// What choosing a move needs to know about it, said once on the snapshot rather than worked out in
// the row: whether it is taken, how many times, and whether it can be taken again.
const move = (taken, max, selectable = taken < max) => new MoveSnapshotBuilder()
	.withSlug("m").withName("M").withSelection(new ValueMax(taken, max)).withSelectable(selectable).build();

describe("MoveSnapshot, as a choice", () => {
	it("is taken from its first take", () => {
		expect(move(0, 1).isTaken).toBe(false);
		expect(move(1, 1).isTaken).toBe(true);
	});

	it("counts its takes against the book's limit", () => {
		const m = move(2, 3);
		expect([m.timesTaken, m.maxTakes]).toEqual([2, 3]);
	});

	it("is repeatable only where the book allows more than one take", () => {
		expect(move(0, 1).isRepeatable).toBe(false);
		expect(move(0, 3).isRepeatable).toBe(true);
	});

	it("can be taken again between its first take and its limit", () => {
		expect(move(0, 3).canTakeAgain).toBe(false);
		expect(move(1, 3).canTakeAgain).toBe(true);
		expect(move(3, 3).canTakeAgain).toBe(false);
		expect(move(1, 1).canTakeAgain).toBe(false);
	});

	it("reads as untaken where nothing says how many takes it has", () => {
		const m = new MoveSnapshotBuilder().withSlug("m").withName("M").build();
		expect([m.isTaken, m.timesTaken, m.maxTakes, m.canTakeAgain]).toEqual([false, 0, 1, false]);
	});
});

describe("MoveCategorySnapshot, as a choice", () => {
	const category = moves => new MoveCategorySnapshotBuilder().withKey("k").withLabel("K").withMoves(moves).build();

	it("offers a choice while one of its moves is not taken", () => {
		expect(category([move(1, 1), move(0, 1)]).offersChoice).toBe(true);
	});

	it("offers a choice while one of its moves can be taken again", () => {
		expect(category([move(1, 3)]).offersChoice).toBe(true);
	});

	it("rests on the moves taken", () => {
		const taken = move(1, 1), other = move(0, 1);
		expect(category([taken, other]).taken).toEqual([taken]);
	});

	it("names its door by whether anything is taken yet", () => {
		expect(category([move(1, 1), move(0, 1)]).door).toBe("change");
		expect(category([move(0, 1)]).door).toBe("choose");
	});

	// The Moves tab's section, which a route — the Level Up checklist's step — can open by name.
	it("is a section on the Moves tab under its own key", () => {
		expect(category([]).sectionKey).toBe("moves-k");
		expect(MoveCategorySnapshot.sectionKeyFor("playbook-the-fox")).toBe("moves-playbook-the-fox");
	});

	it("knows whether it is a playbook's", () => {
		const of = key => new MoveCategorySnapshotBuilder().withKey(key).withMoves([]).build();
		expect([of("playbook-the-fox").isPlaybook, of("other").isPlaybook]).toEqual([true, false]);
	});

	// Every dropped move is taken, once: "Other Moves" has nothing on offer and so no door.
	it("offers none when every move is taken as often as it can be", () => {
		expect(category([move(1, 1), move(3, 3)]).offersChoice).toBe(false);
	});
});
