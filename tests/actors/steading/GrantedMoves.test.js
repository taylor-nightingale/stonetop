import { describe, it, expect, vi } from "vitest";
import { GrantedMoves } from "../../../src/actors/steading/GrantedMoves.js";

const HUNT = {
	_id: "abc", name: "Lead the Aurochs Hunt", img: "systems/stonetop/assets/hunt.webp",
	system: { slug: "lead-the-aurochs-hunt", rollStat: "defenses" },
};
const NEWS = { _id: "def", name: "News at the Inn", system: { slug: "news-at-the-inn" } };

function build(entries = [HUNT, NEWS]) {
	const repo = {
		getMoveEntriesBySlugs: vi.fn(async slugs =>
			slugs.map(s => entries.find(e => e.system.slug === s)).filter(Boolean)),
	};
	const actor = { rollItem: vi.fn(async () => {}) };
	return { actor, repo, moves: new GrantedMoves(actor, repo) };
}

describe("GrantedMoves.bySlug", () => {
	it("keys the moves it finds by slug", async () => {
		const { moves } = build();
		const found = await moves.bySlug(["lead-the-aurochs-hunt"]);
		expect(found["lead-the-aurochs-hunt"].name).toBe("Lead the Aurochs Hunt");
	});

	// One lookup per render, not one per line: the same move is granted in more than one place.
	it("asks for each slug once", async () => {
		const { repo, moves } = build();
		await moves.bySlug(["news-at-the-inn", "news-at-the-inn", null, ""]);
		expect(repo.getMoveEntriesBySlugs).toHaveBeenCalledWith(["news-at-the-inn"]);
	});

	it("asks for nothing when nothing is granted", async () => {
		const { repo, moves } = build();
		expect(await moves.bySlug([])).toEqual({});
		expect(repo.getMoveEntriesBySlugs).not.toHaveBeenCalled();
	});

	// A move deleted from the pack leaves the improvement's prose intact and simply offers no control.
	it("drops a slug the pack does not have", async () => {
		const { moves } = build();
		expect(await moves.bySlug(["nope"])).toEqual({});
	});
});

describe("GrantedMoves.roll", () => {
	// Never embedded on the steading, so this rolls a pack entry — which carries everything a move
	// roll reads.
	it("rolls the pack's move as the steading", async () => {
		const { actor, moves } = build();
		expect(await moves.roll("lead-the-aurochs-hunt")).toBe(true);
		expect(actor.rollItem).toHaveBeenCalledWith(HUNT);
	});

	it("rolls nothing for a slug the pack does not have", async () => {
		const { actor, moves } = build();
		expect(await moves.roll("nope")).toBe(false);
		expect(actor.rollItem).not.toHaveBeenCalled();
	});
});
