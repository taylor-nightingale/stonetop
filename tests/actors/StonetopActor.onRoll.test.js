import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStonetopActorClass } from "../../src/actors/StonetopActor.js";

// The die on a rendered move row, and how it finds the move it belongs to.
//
// A row that draws an OWNED move stamps its id on the `<li>`, and the roll resolves the item from it
// — that is what gets the move's own result tiers onto the chat card instead of a bare stat roll.
// Not every rendered move is owned, though: the moves a steading improvement CONFERS are looked up
// from the pack, so their rows name the move by slug instead, and the die has to follow that.

function makeActor(typedActor, items = new Map()) {
	const Base = class {
		items = items;
	};
	const actor = new (createStonetopActorClass(Base))();
	actor._typedActor = typedActor;
	return actor;
}

const dieEvent = ({ slug = null, itemId = null } = {}) => {
	const die = { dataset: { roll: "defenses", ...(slug ? { moveSlug: slug } : {}) } };
	const row = { dataset: { itemId: itemId ?? "" } };
	return { target: { closest: sel => (sel === "[data-roll]" ? die : row) } };
};

let typedActor;
beforeEach(() => {
	typedActor = { rollMode: "normal", rollMoveBySlug: vi.fn(async () => true) };
});

describe("StonetopActor._onRoll", () => {
	it("rolls a slug-named move through the typed actor when no owned item backs the row", async () => {
		const actor = makeActor(typedActor);
		expect(await actor._onRoll(dieEvent({ slug: "lead-the-aurochs-hunt" }))).toBe(true);
		expect(typedActor.rollMoveBySlug).toHaveBeenCalledWith("lead-the-aurochs-hunt");
	});

	// The owned item wins: it is the copy this actor has, edits and all.
	it("leaves an owned row alone", async () => {
		const item  = { name: "Defend", system: { rollStat: "defenses" } };
		const actor = makeActor(typedActor, new Map([["owned-1", item]]));
		actor._rolling.execute = vi.fn(async () => {});
		await actor._onRoll(dieEvent({ slug: "defend", itemId: "owned-1" }));
		expect(typedActor.rollMoveBySlug).not.toHaveBeenCalled();
		expect(actor._rolling.execute).toHaveBeenCalled();
	});

	// A bare rating die names no move at all, and still rolls the rating.
	it("still rolls a stat that names no move", async () => {
		const actor = makeActor(typedActor);
		actor._rolling.execute = vi.fn(async () => {});
		expect(await actor._onRoll(dieEvent())).toBe(true);
		expect(typedActor.rollMoveBySlug).not.toHaveBeenCalled();
		expect(actor._rolling.execute).toHaveBeenCalled();
	});
});
