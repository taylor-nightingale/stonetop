import { describe, it, expect } from "vitest";
import { RailMoves } from "../../../../src/model/snapshot/character/RailMoves.js";
import { MoveCategorySnapshotBuilder } from "../../../../src/model/snapshot/character/MoveSnapshot.js";
import { MovelistBuilder } from "../../../../src/model/snapshot/character/Movelist.js";

// D9: the special moves are not a group. Each goes to the thing it attaches to, so the rail asks
// for them one at a time.

const move = (slug, over = {}) => ({ slug, name: slug, replaces: null, ...over });
const category = (key, moves) => new MoveCategorySnapshotBuilder().withKey(key).withLabel(key).withMoves(moves).build();
const movelist = (categories, bySlug = {}) => new MovelistBuilder().withCategories(categories).withBySlug(bySlug).build();

const SPECIAL = category("special", [
	move("advantage-disadvantage"), move("burn-brightly"), move("deaths-door"), move("end-of-session"),
]);

describe("RailMoves", () => {
	it("finds each special move where the rail puts it", () => {
		const rail = RailMoves.from(movelist([SPECIAL]));
		expect(rail.burnBrightly.slug).toBe("burn-brightly");
		expect(rail.endOfSession.slug).toBe("end-of-session");
	});

	it("makes Death's Door the move at zero hit points", () => {
		expect(RailMoves.from(movelist([SPECIAL])).atZeroHp.slug).toBe("deaths-door");
	});

	// A character already dead does not glimpse the Last Door again: the insert gained by dying brings
	// the move made instead of it.
	it("makes a held insert's replacement the move at zero hit points instead", () => {
		const thrall = category("insert-thrall", [move("favor"), move("dark-succor", { replaces: "deaths-door" })]);
		expect(RailMoves.from(movelist([SPECIAL, thrall])).atZeroHp.slug).toBe("dark-succor");
	});

	// An insert's moves are on its own tab (D12), so its category is not among the Moves tab's; the
	// move is still the character's, in the registry of every move the sheet draws.
	it("finds a held insert's replacement although its moves are kept off the Moves tab", () => {
		const succor = move("dark-succor", { replaces: "deaths-door" });
		expect(RailMoves.from(movelist([SPECIAL], { "dark-succor": succor })).atZeroHp.slug).toBe("dark-succor");
	});

	it("has nothing to offer where a character holds none of them", () => {
		const rail = RailMoves.from(movelist([]));
		expect([rail.atZeroHp, rail.burnBrightly, rail.endOfSession]).toEqual([null, null, null]);
	});

	it("keeps each as an own field", () => {
		expect(Object.keys(RailMoves.from(movelist([SPECIAL]))))
			.toEqual(expect.arrayContaining(["atZeroHp", "burnBrightly", "endOfSession"]));
	});
});

describe("CharacterSnapshot.railMoves", () => {
	it("is derived from the character's moves", async () => {
		const { CharacterSnapshotBuilder } = await import("../../../../src/model/snapshot/character/CharacterSnapshot.js");
		const snap = new CharacterSnapshotBuilder().withDebilities([]).withStats({}).withMoves(movelist([SPECIAL])).build();
		expect(snap.railMoves).toBeInstanceOf(RailMoves);
		expect(snap.railMoves.atZeroHp.slug).toBe("deaths-door");
	});
});
