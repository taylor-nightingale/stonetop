import { describe, it, expect } from "vitest";
import { buildMoveSnapshot } from "../../src/actors/embeddedMoves.js";
import { MoveSnapshotBuilder } from "../../src/model/snapshot/character/MoveSnapshot.js";
import { MoveResults } from "../../src/model/data/MoveResults.js";

const item = system => ({ _id: "m1", name: "A Move", type: "move", system: { slug: "a-move", ...system } });

describe("buildMoveSnapshot — where a move belongs", () => {
	it("carries the part of an expedition a move is for", () => {
		expect(buildMoveSnapshot(item({ phase: "getting-home" }), "expedition", false, null).phase)
			.toBe("getting-home");
	});

	it("carries the move a move is made instead of", () => {
		expect(buildMoveSnapshot(item({ replaces: "deaths-door" }), "insert-thrall", false, null).replaces)
			.toBe("deaths-door");
	});

	it("says neither for a move that names neither", () => {
		const snap = buildMoveSnapshot(item({}), "basic", false, null);
		expect(snap.phase).toBeNull();
		expect(snap.replaces).toBeNull();
	});

	// A partial invoked with hash params gets a flattened copy of its context, so what a row reads has
	// to be an own field, never a getter.
	it("keeps both as own fields", () => {
		const snap = buildMoveSnapshot(item({ phase: "on-the-road", replaces: "deaths-door" }), "x", false, null);
		expect(Object.keys(snap)).toEqual(expect.arrayContaining(["phase", "replaces"]));
	});
});

describe("buildMoveSnapshot — what a move adds to the roll", () => {
	it("says what the move adds, as its row prints it", () => {
		expect(buildMoveSnapshot(item({ rollStat: "wis" }), "basic", false, null).rollLabel)
			.toBe("+stonetop.character.stats.abbr.wis".toLocaleUpperCase());
	});

	it("says nothing for a move that does not roll", () => {
		expect(buildMoveSnapshot(item({}), "basic", false, null).rollLabel).toBeNull();
	});

	it("keeps it as an own field", () => {
		expect(Object.keys(buildMoveSnapshot(item({ rollStat: "wis" }), "x", false, null))).toContain("rollLabel");
	});
});

// The hover card prints them. Built here rather than at render, so the sheet's one enrichment pass
// reaches their links like every other rich text on the snapshot.
describe("buildMoveSnapshot — its results", () => {
	it("carries the tiers the move authors", () => {
		const snap = buildMoveSnapshot(item({ moveResults: {
			success: { label: "10+", value: "it works" }, partial: { label: "7-9", value: "it costs" },
		} }), "basic", false, null);
		expect(snap.results).toBeInstanceOf(MoveResults);
		expect(snap.results.tiers.map(t => t.key)).toEqual(["success", "partial"]);
	});

	it("has none for a move that authors none", () => {
		expect(buildMoveSnapshot(item({}), "basic", false, null).results).toBeNull();
	});
});

describe("MoveSnapshotBuilder.forArcanum", () => {
	it("gives an arcanum's inline move neither a phase nor a replacement", () => {
		const snap = MoveSnapshotBuilder.forArcanum({ id: "x", name: "X", text: "" });
		expect(snap.phase).toBeNull();
		expect(snap.replaces).toBeNull();
		expect(snap.rollLabel).toBeNull();
	});
});
