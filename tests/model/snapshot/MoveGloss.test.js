import { describe, it, expect } from "vitest";
import { MoveGloss } from "../../../src/model/snapshot/character/MoveGloss.js";
import { rich } from "../../../src/model/snapshot/RichText.js";

// The book's own phrasing, quoted from packs/src/moves/homefront — the point of the gloss is that it
// is lifted, never authored, so these cases are the real text.
describe("MoveGloss", () => {
	it.each([
		["Bolster",
			"When you **_prepare for what's coming or seek the favor of the gods_**, say how and answer the GM's questions.",
			"prepare for what's coming or seek the favor of the gods"],
		["Deploy",
			"When you **_send a steading's people into danger or rally them against an attack_**, roll +Defenses: **on a 10+**, it goes as well as can be expected.",
			"send a steading's people into danger or rally them against an attack"],
		["Muster",
			"When you **_press every able body into the defense of a steading_**, reduce Fortunes by 1 and roll +Population: **on a 7+**, the steading is alert.",
			"press every able body into the defense of a steading"],
		["Pull Together",
			"When you **_set a community to work on improvements_**, to secure new resources, spend whatever the GM says is required.",
			"set a community to work on improvements"],
		["Meet With Disaster",
			"When **_calamity befalls the steading or panic spreads_**, reduce Fortunes by 1 (min -1).",
			"calamity befalls the steading or panic spreads"],
	])("glosses %s with the trigger the book emphasises", (_name, description, expected) => {
		expect(MoveGloss.from(description)).toBe(expected);
	});

	// A move with two triggers is glossed by the one it leads with — not both, and not the second.
	it("takes the first trigger when a move has several", () => {
		const convalesce = "When you **_rest for a few days, in safety and comfort_**, recover all your HP. "
			+ "When you **_rest for a few weeks under the care of a healer_**, heal any problematic wounds.";
		expect(MoveGloss.from(convalesce)).toBe("rest for a few days, in safety and comfort");
	});

	// A move's result tiers are emphasised exactly as its trigger is. Taking the first run keeps
	// them out of a normal move; skipping them keeps them out of one that emphasises nothing else.
	it("skips the result tiers even when they are the only emphasis in the move", () => {
		const gloss = MoveGloss.from("Roll +Defenses: **on a 10+**, it works; **on a 7-9**, it works but someone picks 1.");
		// Not "on a 10+" — it falls through to the sentence, which at least says what the move does.
		expect(gloss).toBe("Roll +Defenses: on a 10+, it works; on a 7-9, it works but someone picks 1.");
	});

	it("accepts a RichText as readily as a raw string", () => {
		expect(MoveGloss.from(rich("When you **_hold the line_**, roll +Defenses."))).toBe("hold the line");
	});

	it.each([
		["single asterisks", "When you *walk the old road*, say where.", "walk the old road"],
		["underscores",      "When you _walk the old road_, say where.", "walk the old road"],
		["underscore-bold",  "When you __*walk the old road*__, say where.", "walk the old road"],
	])("reads %s too", (_label, description, expected) => {
		expect(MoveGloss.from(description)).toBe(expected);
	});

	describe("with no emphasis to lift", () => {
		it("falls back to the first sentence", () => {
			expect(MoveGloss.from("Roll +Fortunes. Then say what happens.")).toBe("Roll +Fortunes.");
		});

		it("caps a long one rather than letting a label wrap", () => {
			const long = `Roll +Fortunes and then ${"say what happens ".repeat(12)}.`;
			const gloss = MoveGloss.from(long);
			expect(gloss.length).toBeLessThanOrEqual(90);
			expect(gloss.endsWith("…")).toBe(true);
		});

		it("stops at the first line break, not just the first full stop", () => {
			expect(MoveGloss.from("Pick one\n\n- a thing\n- another")).toBe("Pick one");
		});
	});

	it.each([["empty", ""], ["blank", "   "], ["null", null], ["undefined", undefined]])
		("returns nothing for a %s description", (_label, value) => {
			expect(MoveGloss.from(value)).toBe("");
		});

	// Emphasis markers left inside a nested run would render as literal asterisks in the row.
	it("returns plain text, whatever nesting it came out of", () => {
		expect(MoveGloss.from("When you **_hold *the* line_**, roll.")).toBe("hold the line");
	});
});
