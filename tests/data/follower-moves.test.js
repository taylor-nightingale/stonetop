import { describe, it, expect } from "vitest";
import { FOLLOWER_MOVES } from "../../module/data/follower-moves.js";

// The character sheet's "Follower Special Moves" section renders read-only from
// this generated module (built from packs/src/stonetop-items/follower-moves/ by
// scripts/gen-data-exports.js). The export previously broke silently to [] when
// the generator's source path went stale, which would blank the section — so
// guard that it stays populated and complete.
describe("FOLLOWER_MOVES", () => {
	it("includes every universal follower special move, in rulebook order", () => {
		expect(FOLLOWER_MOVES.map(m => m.name)).toEqual([
			"Order Followers",
			"Strengthen Your Bond",
			"Followers in Fights",
		]);
	});

	// "Loyal to the End" is the Ranger's animal-companion move (Book I p.143), not a
	// universal follower move — it must not leak back into the shared list.
	it("does not include the Ranger's Loyal to the End", () => {
		expect(FOLLOWER_MOVES.map(m => m.name)).not.toContain("Loyal to the End");
	});

	it("carries non-empty HTML descriptions", () => {
		for (const move of FOLLOWER_MOVES) {
			expect(move.description).toMatch(/<p>.*<\/p>/s);
		}
	});
});
