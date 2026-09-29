import { describe, it, expect } from "vitest";
import { MoveRollLabel } from "../../../../src/model/snapshot/character/MoveRollLabel.js";

// What a move adds to 2d6, as its row's stat column says it.

const WORDS = {
	"stonetop.character.stats.abbr.int": "INT",
	"stonetop.steading.attrShort.fortunes": "Fort",
	"stonetop.steading.attrShort.population": "Pop",
	"stonetop.character.moves.rollLabel.ask": "Any",
	"stonetop.character.moves.rollLabel.favor": "Favor",
};
const localize = key => WORDS[key] ?? key;

const label = rollStat => MoveRollLabel.of(rollStat, localize);

describe("MoveRollLabel", () => {
	it("adds a stat by its short name", () => {
		expect(label("int")).toBe("+INT");
	});

	// "+FORTUNES" in full was the widest thing in the rail and broke "Requisition" mid-word.
	it("adds a steading rating by the short form the steading already uses", () => {
		expect(label("fortunes")).toBe("+FORT");
		expect(label("population")).toBe("+POP");
	});

	it("says a move the player picks the stat for adds any", () => {
		expect(label("ask")).toBe("+ANY");
	});

	it("names a container's own track", () => {
		expect(label("favor")).toBe("+FAVOR");
	});

	// A prompt move rolls plain 2d6, so there is nothing to add; the die alone says it rolls.
	it("says nothing for a move that rolls with nothing added", () => {
		expect(label("prompt")).toBeNull();
	});

	it("says nothing for a move that does not roll", () => {
		expect(label(null)).toBeNull();
		expect(label("")).toBeNull();
	});

	it("falls back to the key itself for a track it has no word for", () => {
		expect(label("grit")).toBe("+GRIT");
	});
});
