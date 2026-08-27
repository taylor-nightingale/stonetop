import { describe, expect, it, vi } from "vitest";
import { MoveRequirements } from "../../../src/model/data/MoveRequirements.js";

const moveRepo = () => ({
	namesBySlug: vi.fn(async () => new Map([["battery", "Battery"], ["eye-of-the-storm", "Eye of the Storm"]])),
});
const playbookRepo = () => ({
	namesBySlug: vi.fn(async () => new Map([["the-heavy", "The Heavy"], ["the-fox", "The Fox"]])),
});

// The collaborators that own each answer. Mutable on purpose: all three change during play, and
// MoveRequirements must never hold a copy of any of them.
// The PlaybookSelection leaf: one fact, read live.
const fakeSelection = (slug = "the-heavy") => ({ slug });

// Which moves are taken is CharacterMoves' knowledge, handed in at the moment of asking.
const acquired = (...slugs) => new Set(slugs);

const requirements = (
	{ vitals = { level: 6 }, playbook = fakeSelection() } = {},
	moveNames = moveRepo(), playbookNames = playbookRepo(),
) => new MoveRequirements(vitals, playbook, moveNames, playbookNames);

describe("MoveRequirements — what it says", () => {
	it("resolves move and playbook slugs to their names", async () => {
		expect(await requirements().labelFor({ playbook: "the-heavy", moves: ["battery"], level: 6 }))
			.toBe("The Heavy, Battery, Level 6");
	});

	// The point of storing slugs: the label follows whatever the catalog calls them, so a translated
	// pack yields a translated requirement without the reference ever moving.
	it("reads whatever the catalog calls them", async () => {
		const german = { namesBySlug: async () => new Map([["battery", "Batterie"]]) };
		expect(await requirements({}, german).labelFor({ moves: ["battery"] })).toBe("Batterie");
	});

	// A requirement can name a move the character does not own — an arcanum's move may require two
	// from a playbook that is not theirs — so names come from the catalog, never from the character.
	it("names a move the character does not have", async () => {
		expect(await requirements().labelFor({ moves: ["eye-of-the-storm"] })).toBe("Eye of the Storm");
	});

	it("shows an unresolvable reference as itself rather than blanking the requirement", async () => {
		expect(await requirements().labelFor({ moves: ["no-such-move"] })).toBe("no-such-move");
	});

	it("shows a note, which is a condition rather than a reference", async () => {
		expect(await requirements().labelFor({ note: "Strength +2 or higher" })).toBe("Strength +2 or higher");
	});

	it("orders playbook, then moves, then note, then level", async () => {
		expect(await requirements().labelFor({ playbook: "the-fox", moves: ["battery"], note: "Cunning", level: 3 }))
			.toBe("The Fox, Battery, Cunning, Level 3");
	});

	it("works with no catalogs at all, falling back to the raw references", async () => {
		expect(await new MoveRequirements({ level: 6 }, fakeSelection()).labelFor({ moves: ["battery"] }))
			.toBe("battery");
	});

	it("is empty for a requirement with nothing in it, without consulting a catalog", () => {
		const moves = moveRepo();
		const req = requirements({}, moves);
		expect(req.isEmpty(null)).toBe(true);
		expect(req.isEmpty({ moves: [], note: "  " })).toBe(true);
		expect(req.isEmpty({ moves: ["battery"] })).toBe(false);
		expect(moves.namesBySlug).not.toHaveBeenCalled();
	});
});

describe("MoveRequirements — whether it is met", () => {
	it("is met when every gate passes", () => {
		expect(requirements().isMet({ playbook: "the-heavy", moves: ["battery"], level: 6 }, acquired("battery"))).toBe(true);
	});

	it("is met when there is no requirement", () => {
		expect(requirements().isMet(null)).toBe(true);
	});

	it("fails on level", () => {
		expect(requirements({ vitals: { level: 2 } }).isMet({ level: 6 })).toBe(false);
	});

	// The gate that only bites when a move is reached for from another playbook (Versatile).
	it("fails on the playbook gate", () => {
		const req = requirements();
		expect(req.isMet({ playbook: "the-fox" })).toBe(false);
		expect(req.isMet({ playbook: "the-heavy" })).toBe(true);
	});

	it("fails on a move the character has not acquired", () => {
		expect(requirements().isMet({ moves: ["battery"] }, acquired())).toBe(false);
	});

	// Copies embedded before references became slugs still hold names; slugging both sides means one
	// path serves old and new data without a migration.
	it("still matches a reference stored as a name", () => {
		const req = requirements();
		expect(req.isMet({ moves: ["Battery"] }, acquired("battery"))).toBe(true);
		expect(req.isMet({ playbook: "The Heavy" })).toBe(true);
	});
});

// Level, playbook and acquired moves all change during play. Nothing here may be captured.
describe("MoveRequirements — reads the character live", () => {
	it("sees a level-up without being rebuilt", () => {
		const vitals = { level: 2 };
		const req = requirements({ vitals });
		expect(req.isMet({ level: 6 })).toBe(false);

		vitals.level = 6;
		expect(req.isMet({ level: 6 })).toBe(true);
	});

	it("answers from the slugs it is handed, each time it is asked", () => {
		const req = requirements();
		expect(req.isMet({ moves: ["battery"] }, acquired())).toBe(false);
		expect(req.isMet({ moves: ["battery"] }, acquired("battery"))).toBe(true);
	});

	it("sees the playbook being swapped without being rebuilt", () => {
		const playbook = fakeSelection();
		const req = requirements({ playbook });
		expect(req.isMet({ playbook: "the-fox" })).toBe(false);

		playbook.slug = "the-fox";
		expect(req.isMet({ playbook: "the-fox" })).toBe(true);
	});

	// It holds two leaves and two catalogs — nothing that could point back at it.
	it("holds no subsystem", () => {
		const req = requirements();
		for (const held of Object.values(req)) {
			expect(typeof held?.buildSnapshot, "a subsystem leaked in").toBe("undefined");
		}
	});

	it("tolerates collaborators it was never given", () => {
		const req = new MoveRequirements();
		expect(req.level).toBe(1);
		expect(req.playbookSlug).toBeNull();
		expect(req.isMet({ moves: ["battery"] })).toBe(false);
	});

	it("builds the snapshot a move carries, or null when there is nothing to show", async () => {
		const req = requirements();
		expect(await req.snapshotFor(null)).toBeNull();

		const snap = await req.snapshotFor({ playbook: "the-heavy", moves: ["battery"] }, acquired("battery"));
		expect(snap.label).toBe("The Heavy, Battery");
		expect(snap.met).toBe(true);

		expect((await req.snapshotFor({ moves: ["battery"] }, acquired())).met).toBe(false);
	});
});
