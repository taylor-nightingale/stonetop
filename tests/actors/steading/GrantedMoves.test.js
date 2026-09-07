import { describe, it, expect, vi } from "vitest";
import { GrantedMoves } from "../../../src/actors/steading/GrantedMoves.js";

const HUNT = {
	_id: "abc", name: "Lead the Aurochs Hunt", img: "systems/stonetop/assets/hunt.webp",
	system: {
		slug: "lead-the-aurochs-hunt", rollStat: "defenses",
		description: "When you **_lead the aurochs hunt_**, roll +Defenses…",
		moveResults: { success: { label: "10+", value: "A clean kill." } },
	},
};
const NEWS = { _id: "def", name: "News at the Inn", system: { slug: "news-at-the-inn" } };

function build(entries = [HUNT, NEWS]) {
	const repo = {
		getMoveEntriesBySlugs: vi.fn(async slugs =>
			slugs.map(s => entries.find(e => e.system.slug === s)).filter(Boolean)),
	};
	return { repo, moves: new GrantedMoves({}, repo) };
}

const sources = entries => new Map(entries);

describe("GrantedMoves.bySlug", () => {
	it("keys the moves it finds by slug", async () => {
		const { moves } = build();
		const found = await moves.bySlug(sources([["lead-the-aurochs-hunt", "Aurochs Hunting"]]));
		expect(found["lead-the-aurochs-hunt"].name).toBe("Lead the Aurochs Hunt");
	});

	// The row is the move, not a fragment of it beside a button: everything a move row draws — its
	// die, its text, the result tiers behind its disclosure — comes off this snapshot.
	it("builds the move as an ordinary move row would draw it", async () => {
		const { moves } = build();
		const hunt = (await moves.bySlug(sources([["lead-the-aurochs-hunt", "Aurochs Hunting"]])))["lead-the-aurochs-hunt"];
		expect(hunt.rollStat).toBe("defenses");
		expect(hunt.description.raw).toContain("roll +Defenses");
		expect(hunt.icon).toBe("systems/stonetop/assets/hunt.webp");
	});

	// Never owned, so there is no owned id to roll through — the row names its move by slug instead,
	// and nothing about it is the steading's to take.
	it("carries no owned id and offers no acquisition tick", async () => {
		const { moves } = build();
		const hunt = (await moves.bySlug(sources([["lead-the-aurochs-hunt", "Aurochs Hunting"]])))["lead-the-aurochs-hunt"];
		expect(hunt.ownedId).toBeNull();
		expect(hunt.selectable).toBe(false);
	});

	// Collected by when it fires rather than under the thing that granted it, so the row has to say.
	it("labels each row with the improvement that conferred it", async () => {
		const { moves } = build();
		const found = await moves.bySlug(sources([["news-at-the-inn", "Inn"]]));
		expect(found["news-at-the-inn"].sourceLabel).toBe("Inn");
	});

	// One lookup per render, not one per line: the same move is granted in more than one place.
	it("asks for each slug once", async () => {
		const { repo, moves } = build();
		await moves.bySlug(sources([["news-at-the-inn", "Inn"], ["", "Nothing"]]));
		expect(repo.getMoveEntriesBySlugs).toHaveBeenCalledWith(["news-at-the-inn"]);
	});

	it("asks for nothing when nothing is granted", async () => {
		const { repo, moves } = build();
		expect(await moves.bySlug(new Map())).toEqual({});
		expect(repo.getMoveEntriesBySlugs).not.toHaveBeenCalled();
	});

	// A move deleted from the pack leaves the improvement's results intact and simply offers no row.
	it("drops a slug the pack does not have", async () => {
		const { moves } = build();
		expect(await moves.bySlug(sources([["nope", "Somewhere"]]))).toEqual({});
	});
});
