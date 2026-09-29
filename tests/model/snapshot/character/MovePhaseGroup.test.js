import { describe, it, expect } from "vitest";
import { MovePhaseGroup } from "../../../../src/model/snapshot/character/MovePhaseGroup.js";

const move = (slug, phase = null) => ({ slug, phase });

describe("MovePhaseGroup.fromMoves", () => {
	it("groups moves by the part of the journey they are for, in the journey's order", () => {
		const groups = MovePhaseGroup.fromMoves([
			move("return-triumphant", "getting-home"),
			move("forage", "on-the-road"),
			move("outfit", "setting-out"),
			move("recover", "on-the-road"),
		]);
		expect(groups.map(g => g.key)).toEqual(["setting-out", "on-the-road", "getting-home"]);
		expect(groups[1].moves.map(m => m.slug)).toEqual(["forage", "recover"]);
	});

	it("leaves out a phase no move is for", () => {
		expect(MovePhaseGroup.fromMoves([move("forage", "on-the-road")]).map(g => g.key)).toEqual(["on-the-road"]);
	});

	// A move no phase names is not lost: it comes last, under no heading.
	it("puts moves with no phase last, as a group with no key", () => {
		const groups = MovePhaseGroup.fromMoves([move("homebrew"), move("forage", "on-the-road")]);
		expect(groups.map(g => g.key)).toEqual(["on-the-road", null]);
		expect(groups[1].moves.map(m => m.slug)).toEqual(["homebrew"]);
	});

	it("names each phase's heading by key, and gives the unphased none", () => {
		const [phased, rest] = MovePhaseGroup.fromMoves([move("forage", "on-the-road"), move("homebrew")]);
		expect(phased.labelKey).toBe("stonetop.character.moves.phase.on-the-road");
		expect(rest.labelKey).toBeNull();
	});

	it("is empty for no moves", () => {
		expect(MovePhaseGroup.fromMoves([])).toEqual([]);
	});
});
